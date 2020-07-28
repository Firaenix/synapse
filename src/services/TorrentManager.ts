import { PeerManager } from './PeerDiscovery';
import { MetainfoFile } from '../models/MetainfoFile';
import { HashService } from './HashService';
import { Peer } from './Peer';
import { DiskFile } from '../models/DiskFile';
import Bitfield from 'bitfield';
import { chunkBuffer } from '../utils/chunkBuffer';
import { WebRTCPeerStrategy } from './WebRTCPeerStrategy';
export class TorrentManager {
  private readonly peerManager: PeerManager;
  private readonly peers: Array<Peer> = [];
  private readonly fileBufferChunks: Buffer[] | undefined;
  private infoHash: Buffer;
  private bitfield: Bitfield;

  /**
   * if files is undefined, you are a leech, seeders have all the data
   * @param peerDiscovery
   * @param hashService
   * @param metainfoFile
   * @param files
   */
  constructor(private hashService: HashService, private metainfoFile: MetainfoFile, public files: DiskFile[] | undefined) {
    this.infoHash = metainfoFile.infohash;
    this.bitfield = new Bitfield(metainfoFile.info.pieces.length);

    if (files) {
      this.fileBufferChunks = files.map((x) => chunkBuffer(x.file, metainfoFile.info['piece length'])).flat();

      // Mark that we have all the bits
      for (let i = 0; i <= this.fileBufferChunks.length; i++) {
        this.bitfield.set(i, true);
      }
    }

    console.log(this.bitfield.buffer);
    console.log(this.infoHash.toString('hex'));

    this.peerManager = new PeerManager(this.hashService, [new WebRTCPeerStrategy()], this.metainfoFile, this.infoHash, this.bitfield, this.fileBufferChunks, this.onPeerFound);
  }

  private onPeerFound = () => {
    // this.addPeer()
  };

  private onPieceValidated = () => {};

  public addPeer = (peer: Peer) => {
    this.peers.push(peer);
  };
}
