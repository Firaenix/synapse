import { MetainfoFile } from './models/MetainfoFile';
import { TorrentInstance } from './services/TorrentInstance';
import { Extension } from '@firaenix/bittorrent-protocol';
import { HashService } from './services/HashService';

export interface Settings {
  metainfos: MetainfoFile[];
  extensions?: Extension[];
}

const defaultSettings: Settings = {
  metainfos: [],
  // Add Bitcoin, ECDH
  extensions: []
};

/**
 * Manages the instances of torrents we want to download and seed
 * Client -> Torrent -> Peers
 */
export class Client {
  private torrents: TorrentInstance[];
  private hashService = new HashService();

  constructor(settings: Settings = defaultSettings) {
    for (const metainfo of settings.metainfos) {
      this.torrents.push(new TorrentInstance(metainfo, this.hashService));
    }
  }

  /**
   * Starts Seeding
   * @param metainfo
   */
  public addMetainfo = (metainfo: MetainfoFile) => {
    this.torrents.push(new TorrentInstance(metainfo, this.hashService));
  };
}
