import { MetainfoFile } from '../models/MetainfoFile';
import { Peer } from './Peer';
import Bitfield from 'bitfield';
import { HashService } from './HashService';
import { IPeerStrategy } from './interfaces/IPeerStrategy';
import Wire from '@firaenix/bittorrent-protocol';

export class PeerManager {
  constructor(
    private hashService: HashService,
    private peerDiscoveryStrategies: Array<IPeerStrategy>,
    private metainfoFile: MetainfoFile,
    private infoHash: Buffer,
    private bitfield: Bitfield,
    private fileChunks: Array<Buffer> | undefined,
    private onPeerFoundCallback: (peer: Peer) => void
  ) {
    for (const strategy of this.peerDiscoveryStrategies) {
      strategy.startDiscovery(this.infoHash, this.onWireConnected);
    }
  }

  private onWireConnected = (connectedWire: Wire) => {
    const peer = new Peer(connectedWire, this.metainfoFile, this.infoHash, this.bitfield, this.fileChunks, this.hashService);
    this.onPeerFoundCallback(peer);
  };
}
