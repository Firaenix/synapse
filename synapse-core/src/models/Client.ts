import { Metainfo } from './Metainfo';

export interface IKnotClient {
  downloadTorrent: (torrentFile: Metainfo) => Promise<void>;

  removeDownloadedTorrent: (torrentFile: Metainfo) => Promise<void>;
  
  seedTorrent: (torrentFile: Metainfo) => Promise<void>;

  removeSeededTorrent: (torrentFile: Metainfo) => Promise<void>;
}