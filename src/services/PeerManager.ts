import Wire from '@firaenix/bittorrent-protocol';
import Bitfield from 'bitfield';
import { EventEmitter } from 'events';
import { inject, injectable, injectAll } from 'tsyringe';
import { v4 as uuid } from 'uuid';

import { MetadataExtension } from '../extensions/Metadata';
import { SupportedHashAlgorithms } from '../models/SupportedHashAlgorithms';
import { IHashService } from './HashService';
import { ILogger } from './interfaces/ILogger';
import { IPeerStrategy, PeerStrategyEvents } from './interfaces/IPeerStrategy';
import { MetaInfoService } from './MetaInfoService';
import { Peer, PeerEvents } from './Peer';
import { PieceManager } from './PieceManager';

export const PeerManagerEvents = {
  got_piece: Symbol('on:piece'),
  got_bitfield: Symbol('on:bitfield'),
  got_request: Symbol('on:request')
};

@injectable()
export class PeerManager extends EventEmitter {
  private peerId: Buffer;
  private readonly peers: Array<Peer> = [];

  constructor(
    @inject('IHashService') private readonly hashService: IHashService,
    @injectAll('IPeerStrategy') private readonly peerDiscoveryStrategies: Array<IPeerStrategy>,
    private readonly pieceManager: PieceManager,
    private readonly metainfoService: MetaInfoService,
    @inject('ILogger') private readonly logger: ILogger
  ) {
    super();
    this.peerId = Buffer.from(this.hashService.hash(Buffer.from(uuid()), SupportedHashAlgorithms.sha1));
    console.log('PEER MANAGER PEERID', this.peerId);

    for (const strategy of peerDiscoveryStrategies) {
      strategy.on(PeerStrategyEvents.found, this.onWireConnected);
      strategy.on(PeerStrategyEvents.got_update, (key) => {
        this.logger.info(strategy.name, 'Updated', key);
      });
    }
  }

  public searchByInfoIdentifier = (infoIdentifier: Buffer) => {
    const infoHashHash = this.hashService.hash(infoIdentifier, SupportedHashAlgorithms.sha256);

    for (const strategy of this.peerDiscoveryStrategies) {
      strategy.startDiscovery(infoHashHash);
    }
  };

  /**
   * Broadcasts to all peers that we are no longer interested in downloading.
   */
  public setUninterested = () => {
    for (const peer of this.peers) {
      peer.wire.uninterested();
    }
  };

  public have = (index: number) => {
    for (const peer of this.peers) {
      peer.wire.have(index);
    }
  };

  public getPeerThatHasPiece = (pieceIndex: number) => {
    for (const peer of this.peers) {
      if (!peer.bitfield?.get(pieceIndex)) {
        continue;
      }

      return peer;
    }
    return undefined;
  };

  public requestPieceAsync = (index: number, offset: number, length: number) =>
    new Promise<void>((resolve, reject) => {
      // Smartly find a peer that does have the piece we need
      this.logger.warn('NEED TO FIND SMARTER WAY OF REQUESTING PIECES!');
      const peer = this.peers.find((x) => x.bitfield?.get(index) !== undefined);

      if (!peer) {
        return reject(new Error("Can't find a peer with that piece"));
      }

      peer.wire.request(index, offset, length, (err) => {
        if (err !== undefined) {
          return reject(err);
        }

        return resolve();
      });
    });

  private onWireConnected = (connectedWire: Wire, infoIdentifier: Buffer) => {
    console.log('WIRE CONNECTED');
    connectedWire.use((w) => new MetadataExtension(w, this.metainfoService));

    const peer = new Peer(connectedWire, infoIdentifier, this.peerId, this.logger);

    this.addPeer(peer);
  };

  public addPeer = (peer: Peer) => {
    peer.on(PeerEvents.got_piece, this.onPiece);
    peer.on(PeerEvents.got_bitfield, this.onBitfield);
    peer.on(PeerEvents.got_request, this.onRequest);

    peer.on(PeerEvents.need_bitfield, (cb: (bitfield: Bitfield) => void) => {
      cb(this.pieceManager.getBitfield());
    });

    this.peers.push(peer);
    this.logger.log(this.peers.length);
  };

  private onPiece = async (index: number, offset: number, pieceBuf: Buffer) => {
    this.logger.log('Leecher got piece', index, offset, pieceBuf);

    this.emit(PeerManagerEvents.got_piece, index, offset, pieceBuf);

    // TODO: Need to Verify Piece

    // const algo = this.metainfo.info['piece hash algo'];
    // const hash = this.metainfo.info.pieces[index];
    // this.logger.log(this.wire.wireName, ': Checking if piece', index, 'passes', algo, 'check', hash);

    // const pieceHash = hasher.hash(pieceBuf, algo);
    // this.logger.log(this.wire.wireName, 'Does piece match hash?', pieceHash.equals(hash));

    // // Checksum failed - re-request piece
    // if (!pieceHash.equals(hash)) {
    //   this.wire.request(index, offset, this.metainfo.info['piece length'], (err) => {
    //     if (err) {
    //       this.logger.error(this.wire.wireName, 'Error requesting piece again', index, err);
    //       this.onErrorCallback?.(err);
    //     }
    //   });
    //   return;
    // }

    // Piece we recieved is valid, broadcast that I have the piece to other peers, add to downlo
    for (const peer of this.peers) {
      peer.wire.have(index);
    }
  };

  private onBitfield = (wire: Wire, recievedBitfield: Bitfield) => {
    this.emit(PeerManagerEvents.got_bitfield, wire, recievedBitfield);
  };

  private onRequest = (wire: Wire, index: number, offset: number, length: number) => {
    this.logger.log('PeerManager on request', wire.wireName, index, offset, length);
    this.emit(PeerManagerEvents.got_request, wire, index, offset, length);
  };
}
