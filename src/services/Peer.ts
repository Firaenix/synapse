import { ExtendedHandshake, Wire } from '@firaenix/bittorrent-protocol';
import Bitfield from 'bitfield';
import { EventEmitter } from 'events';
import { inject } from 'tsyringe';

import { ILogger } from './interfaces/ILogger';

export const PeerEvents = {
  need_bitfield: Symbol('need:bitfield'),
  got_piece: Symbol('on:piece'),
  got_bitfield: Symbol('on:bitfield'),
  got_request: Symbol('on:request'),
  error: Symbol('error'),
  close: Symbol('close')
};

export class Peer extends EventEmitter {
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
    this.wire.on('extended', this.onExtended);

    this.wire.on('close', this.onWireClosed);

    this.wire.setKeepAlive(true);

    // 1. Send Handshake
    this.wire.handshake(this.infoIdentifier, this.myPeerId);
  }

  private onPiece = (index: number, offset: number, pieceBuf: Buffer) => {
    this.emit(PeerEvents.got_piece, index, offset, pieceBuf);
  };

  private onWireClosed = () => {
    this.emit(PeerEvents.close, this);
  };

  private onError = (...args: unknown[]) => {
    this.emit(PeerEvents.error, this, ...args);
  };

  private onBitfield = (bitfield: Bitfield) => {
    this.bitfield = bitfield;

    this.emit(PeerEvents.got_bitfield, this.wire, bitfield);
  };

  private onRequest = (index: number, offset: number, length: number) => {
    this.emit(PeerEvents.got_request, this.wire, index, offset, length);
  };

  private onExtended = (_: string, extensions: ExtendedHandshake) => {
    this.logger.log(this.wire.wireName, 'Incoming handshake from ', extensions, 'Our peerId:', this.myPeerId.toString('hex'), 'Their PeerId:', this.wire.peerId);

    if (this.myPeerId.toString('hex') === this.wire.peerId) {
      this.logger.warn('Dont want to connect to myself, thats weird.');
      this.wire.end();
      return;
    }

    this.wire.unchoke();

    this.emit(PeerEvents.need_bitfield, (bitfield: Bitfield) => {
      this.wire.bitfield(bitfield);
    });
  };

  public destroy = () => {
    this.wire.destroy();
  };
}
