import { MetainfoFile } from '../models/MetainfoFile';
import { Peer } from './Peer';
import Bitfield from 'bitfield';
import { IHashService } from './HashService';
import { IPeerStrategy } from './interfaces/IPeerStrategy';
import Wire from '@firaenix/bittorrent-protocol';
import { injectable, injectAll, inject } from 'tsyringe';
import { SupportedHashAlgorithms } from '../models/SupportedHashAlgorithms';
import { v4 as uuid } from 'uuid';
import { PieceManager } from './PieceManager';
import { MetaInfoService } from './MetaInfoService';

@injectable()
export class PeerManager {
  private peerId: Buffer;
  private readonly peers: Array<Peer> = [];

  private onPieceValidated: ((index: number, offset: number, piece: Buffer) => void) | undefined;

  constructor(
    @inject('IHashService') private hashService: IHashService,
    @injectAll('IPeerStrategy') private peerDiscoveryStrategies: Array<IPeerStrategy>,
    private readonly metainfoService: MetaInfoService,
    private pieceManager: PieceManager
  ) {
    this.peerId = Buffer.from(this.hashService.hash(Buffer.from(uuid()), SupportedHashAlgorithms.sha1));
  }

  public bootstrapManager = (onPieceValidated: (index: number, offset: number, piece: Buffer) => void) => {
    this.onPieceValidated = onPieceValidated;

    console.log(
      'Setting metainfo',
      this.metainfoService.metainfo,
      this.metainfoService.infohash,
      this.peerId,
      'this.pieceManager.getBitfield().buffer.length',
      this.pieceManager.getBitfield().buffer.length
    );

    for (const strategy of this.peerDiscoveryStrategies) {
      strategy.startDiscovery(this.metainfoService.infohash, this.onWireConnected);
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

  private onWireConnected = (connectedWire: Wire) => {
    console.log('connecting wire, our piece manager:', this.pieceManager);

    const peer = new Peer(connectedWire, this.metainfoService.metainfo, this.metainfoService.infohash, this.pieceManager, this.peerId, (index, offset, piece) => {
      console.log('YES WE GOT A PIECE', index);
      this.onPieceValidated?.(index, offset, piece);
    });
    this.peers.push(peer);
    console.log(this.peers.length);
  };
}
