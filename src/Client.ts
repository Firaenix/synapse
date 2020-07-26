import { MetainfoFile } from './models/MetainfoFile';
import { TorrentInstance } from './services/TorrentInstance';
import Wire, { Extension } from '@firaenix/bittorrent-protocol';
import { HashService } from './services/HashService';
import { DiskFile } from './models/DiskFile';

export interface Settings {
  extensions?: Extension[];
}

const defaultSettings: Settings = {
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

  constructor(settings: Settings = defaultSettings) {}

  /**
   * Starts Seeding
   * @param metainfo
   */
  public addMetainfo = (metainfo: MetainfoFile, files: DiskFile[] | undefined, wire: Wire) => {
    this.torrents.push(new TorrentInstance(metainfo, files, wire, this.hashService));
  };

  public addPeer = () => {
    this.
  }
}
