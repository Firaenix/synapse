import { MetainfoFile } from '../models/MetainfoFile';
import { Peer, PeerEvents } from './Peer';
import Bitfield from 'bitfield';
import { IHashService } from './HashService';
import { IPeerStrategy, PeerStrategyEvents } from './interfaces/IPeerStrategy';
import Wire from '@firaenix/bittorrent-protocol';
import { injectable, injectAll, inject } from 'tsyringe';
import { SupportedHashAlgorithms } from '../models/SupportedHashAlgorithms';
import { v4 as uuid } from 'uuid';
import { EventEmitter } from 'events';
import { PieceManager } from './PieceManager';

export const PeerManagerEvents = {
  valid_piece: Symbol('on:valid_piece'),
  got_bitfield: Symbol('on:bitfield'),
  got_request: Symbol('on:request')
};

@injectable()
export class PeerManager extends EventEmitter {
  private peerId: Buffer;
  private readonly peers: Array<Peer> = [];
  private infoIdentifier: Buffer | undefined;

  constructor(
    @inject('IHashService') private readonly hashService: IHashService,
    @injectAll('IPeerStrategy') private readonly peerDiscoveryStrategies: Array<IPeerStrategy>,
    private readonly pieceManager: PieceManager
  ) {
    super();
    this.peerId = Buffer.from(this.hashService.hash(Buffer.from(uuid()), SupportedHashAlgorithms.sha1));

    for (const strategy of peerDiscoveryStrategies) {
      strategy.on(PeerStrategyEvents.found, this.onWireConnected);
    }
  }

  public searchByInfoIdentifier = (infoIdentifier: Buffer) => {
    if (this.infoIdentifier) {
      throw new Error('Already waiting on an info identifier');
    }

    this.infoIdentifier = infoIdentifier;
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

  private onWireConnected = (strategyName: string, connectedWire: Wire, infoIdentifier: Buffer) => {
    const peer = new Peer(connectedWire, infoIdentifier, this.peerId);

    peer.on(PeerEvents.got_piece, this.onPiece);
    peer.on(PeerEvents.got_bitfield, this.onBitfield);
    peer.on(PeerEvents.got_request, this.onRequest);

    peer.on(PeerEvents.need_bitfield, (cb: (bitfield: Bitfield) => void) => {
      cb(this.pieceManager.getBitfield());
    });

    this.peers.push(peer);
    console.log(this.peers.length);
  };

  private onPiece = async (index: number, offset: number, pieceBuf: Buffer) => {
    console.log('Leecher got piece', index, offset, pieceBuf);

    // TODO: Need to Verify Piece

    // const algo = this.metainfo.info['piece hash algo'];
    // const hash = this.metainfo.info.pieces[index];
    // console.log(this.wire.wireName, ': Checking if piece', index, 'passes', algo, 'check', hash);

    // const pieceHash = hasher.hash(pieceBuf, algo);
    // console.log(this.wire.wireName, 'Does piece match hash?', pieceHash.equals(hash));

    // // Checksum failed - re-request piece
    // if (!pieceHash.equals(hash)) {
    //   this.wire.request(index, offset, this.metainfo.info['piece length'], (err) => {
    //     if (err) {
    //       console.error(this.wire.wireName, 'Error requesting piece again', index, err);
    //       this.onErrorCallback?.(err);
    //     }
    //   });
    //   return;
    // }

    // Piece we recieved is valid, broadcast that I have the piece to other peers, add to downlo
    for (const peer of this.peers) {
      peer.wire.have(index);
    }

    this.emit(PeerManagerEvents.valid_piece, index, offset, pieceBuf);
  };

  private onBitfield = (wire: Wire, recievedBitfield: Bitfield) => {
    this.emit(PeerManagerEvents.got_bitfield, wire, recievedBitfield);
  };

  private onRequest = (wire: Wire, index: number, offset: number, length: number) => {
    console.log('PeerManager on request', wire.wireName, index, offset, length);
    this.emit(PeerManagerEvents.got_request, wire, index, offset, length);
  };
}
