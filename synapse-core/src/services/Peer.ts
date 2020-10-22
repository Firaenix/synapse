import { ExtendedHandshake, Wire } from '@firaenix/bittorrent-protocol';
import Bitfield from 'bitfield';
import { TypedEmitter } from 'tiny-typed-emitter';
import { inject } from 'tsyringe';

import { ILogger } from './interfaces/ILogger';

export enum PeerEvents {
  need_bitfield = 'need:bitfield',
  got_piece = 'on:piece',
  got_bitfield = 'on:bitfield',
  got_request = 'on:request',
  error = 'error',
  close = 'close'
}

interface PeerEmitter {
  [PeerEvents.need_bitfield]: (cb: (bitfield: Bitfield) => void) => void;
  [PeerEvents.close]: () => void;
  [PeerEvents.got_bitfield]: (bitfield: Bitfield) => void;
  [PeerEvents.got_piece]: (index: number, offset: number, buf: Buffer) => void;
  [PeerEvents.got_request]: (index: number, offset: number, length: number) => void;
  [PeerEvents.error]: (error: Error) => void;
}

/**
 * Stores stateful information about a peer while also handling the socket connections over the wire.
 *
 * Provides a wrapper around Wire to safely handle data flow.
 */
export class Peer extends TypedEmitter<PeerEmitter> {
  public bitfield: Bitfield | undefined;

  constructor(public readonly wire: Wire, private readonly infoIdentifier: Buffer, private readonly myPeerId: Buffer, @inject('ILogger') private readonly logger: ILogger) {
    super();

    this.wire.on('error', this.onError);

    // 5. Recieve the actual data pieces
    this.wire.on('piece', this.onPiece);

    // 4. Recieve have requests
    this.wire.on('request', this.onRequest);

    // 3. On recieved Bitfield, go through it and remember the pieces that the peer has.
    // Request all the pieces that the peer has but you dont.
    this.wire.on('bitfield', this.onBitfield);

    // 2. On recieved Extended Handshake (normal handshake follows up with extended handshake), send Bitfield
    this.wire.on('extended_handshake', this.onExtendedHandshake);

    this.wire.on('close', this.onWireClosed);

    this.wire.on('have', this.onHave);

    this.wire.setKeepAlive(true);

    // 1. Send Handshake
    this.wire.handshake(this.infoIdentifier, this.myPeerId);
  }

  private onHave = (index: number) => {
    this.logger.log(this.wire.wireName, 'Peer said that they have this piece', index);
    this.bitfield?.set(index);
  };

  private onPiece = (index: number, offset: number, pieceBuf: Buffer) => {
    this.emit(PeerEvents.got_piece, index, offset, pieceBuf);
  };

  private onWireClosed = () => {
    this.emit(PeerEvents.close);
  };

  private onError = (error: Error) => {
    this.emit(PeerEvents.error, error);
  };

  private onBitfield = (bitfield: Bitfield) => {
    this.bitfield = bitfield;

    this.emit(PeerEvents.got_bitfield, bitfield);
  };

  private onRequest = (index: number, offset: number, length: number) => {
    this.logger.warn(this.wire.wireName, 'Got a request for', index, offset, length);
    this.emit(PeerEvents.got_request, index, offset, length);
  };

  private onExtendedHandshake = (extensionName: string, extensions: ExtendedHandshake) => {
    this.logger.log(this.wire.wireName, 'Incoming extended message from ', extensionName, 'Our peerId:', this.myPeerId.toString('hex'), 'Their PeerId:', this.wire.peerId);

    this.logger.log(this.wire.wireName, 'Supported extensions: ', extensions);

    if (this.myPeerId.toString('hex') === this.wire.peerId) {
      this.logger.warn('Dont want to connect to myself, thats weird.');
      this.wire.end();
      return;
    }

    // Only want to request bitfield after handshake
    if (extensionName === 'handshake') {
      this.wire.unchoke();
      this.emit(PeerEvents.need_bitfield, (bitfield: Bitfield) => {
        this.wire.bitfield(bitfield);
      });
    }
  };

  public destroy = () => {
    this.wire.destroy();
  };

  public request = async (index: number, offset: number, length: number) =>
    new Promise<Buffer>((resolve, reject) => {
      this.wire.request(index, offset, length, (err, buffer) => {
        if (err !== null && err !== undefined) {
          return reject(err);
        }

        if (buffer === null || buffer === undefined) {
          return reject(new Error('No buffer returned from request'));
        }

        return resolve(buffer);
      });
    });

  public cancel = (index: number, offset: number, length: number) => {
    return this.wire.cancel(index, offset, length);
  };

  public have = (index: number) => {
    this.wire.have(index);
  };

  public isClosed = () => {
    return this.wire._finished;
  };

  public setUninterested = () => {
    return this.wire.uninterested();
  };

  public sendBitfield = (bitfield: Bitfield) => {
    return this.wire.bitfield(bitfield);
  };

  public sendPiece = (index: number, offset: number, pieceBuf: Buffer) => {
    return this.wire.piece(index, offset, pieceBuf);
  };

  public unchoke = () => {
    return this.wire.unchoke();
  };

  public get peerId() {
    return this.wire.peerId;
  }

  /**
   * Checks if the peer has any pieces that are missing from the given bitfield.
   *
   * Like a shopping cart, go to supermarket to get pieces they have but you do not.
   *
   * TODO: Get a better name for this method
   * @param bitfield
   */
  public getIndexesThatDontExistInGivenBitfield = (incompleteBitfield: Bitfield, totalPiecesCount: number): number[] => {
    if (this.bitfield === undefined) {
      return [];
    }

    const haveIndicies: number[] = [];

    for (let index = 0; index < totalPiecesCount; index++) {
      // If they dont have the piece, I dont care
      if (this.bitfield.get(index) === false) {
        continue;
      }

      // If the index exists in the incompleteBitfield, I dont care
      if (incompleteBitfield.get(index) === true) {
        continue;
      }

      haveIndicies.push(index);
    }

    return haveIndicies;
  };
}
