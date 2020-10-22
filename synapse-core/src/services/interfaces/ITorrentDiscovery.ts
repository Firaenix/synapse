import { MetainfoFile } from '../../models/MetainfoFile';

export interface ITorrentDiscovery {
  /**
   * Discovers the Metainfo file for an immutable torrent
   * @param infoHash
   */
  discoverByInfoHash(infoHash: Buffer): Promise<MetainfoFile>;

  /**
   * Discovers the SignedMetainfo file for a mutable torrent
   * @param infoSig
   */
  discoverByInfoSig(infoSig: Buffer): Promise<MetainfoFile>;
}
