import { MetainfoFile } from '../models/MetainfoFile';
import { Wire } from '@firaenix/bittorrent-protocol';
import { HashService } from './HashService';
import { chunkBuffer } from '../utils/chunkBuffer';

/**
 * Keeps track of the status of a torrent along with storing references to all peers
 */
export class TorrentInstance {
  private readonly infoHashString: string;
  private readonly fileBufferChunks: Buffer[];

  constructor(private metainfo: MetainfoFile, private hashService: HashService) {
    this.infoHashString = Buffer.from(metainfo.infohash).toString('hex');
    this.fileBufferChunks = files.map((x) => chunkBuffer(x.file, metainfo.info['piece length'])).flat();
    console.log(metainfo);
  }

  public addPeer = (peerWire: Wire) => {};
}
