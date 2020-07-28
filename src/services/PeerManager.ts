import { MetainfoFile } from '../models/MetainfoFile';
import { Peer } from './Peer';
import Bitfield from 'bitfield';
import { IHashService } from './HashService';
import { IPeerStrategy } from './interfaces/IPeerStrategy';
import Wire from '@firaenix/bittorrent-protocol';
import { injectable } from 'tsyringe';
import { SupportedHashAlgorithms } from '../models/SupportedHashAlgorithms';
import { v4 as uuid } from 'uuid';

@injectable()
export class PeerManager {
  private readonly peers: Array<Peer> = [];
  private readonly peerId: Buffer;

  constructor(
    private hashService: IHashService,
    private peerDiscoveryStrategies: Array<IPeerStrategy>,
    private metainfoFile: MetainfoFile,
    private infoHash: Buffer,
    private bitfield: Bitfield,
    private fileChunks: Array<Buffer> | undefined,
    private onPeerFoundCallback: (peer: Peer) => void
  ) {
    this.peerId = Buffer.from(this.hashService.hash(Buffer.from(uuid()), SupportedHashAlgorithms.sha1));

    for (const strategy of this.peerDiscoveryStrategies) {
      strategy.startDiscovery(this.infoHash, this.onWireConnected);
    }
  }

  private onWireConnected = (connectedWire: Wire) => {
    const peer = new Peer(connectedWire, this.metainfoFile, this.infoHash, this.bitfield, this.fileChunks, this.peerId, this.hashService);
    this.peers.push(peer);
    this.onPeerFoundCallback(peer);
  };
}
