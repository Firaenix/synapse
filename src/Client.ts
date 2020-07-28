import { MetainfoFile } from './models/MetainfoFile';
import { Extension } from '@firaenix/bittorrent-protocol';
import { HashService, IHashService } from './services/HashService';
import { DiskFile } from './models/DiskFile';
import { TorrentManager } from './services/TorrentManager';
import { container, autoInjectable, inject } from 'tsyringe';

export interface Settings {
  extensions?: Extension[];
}

const defaultSettings: Settings = {
  // Add Bitcoin, ECDH
  extensions: []
};

container.register('IHashService', {
  useClass: HashService
});

/**
 * Manages the instances of torrents we want to download and seed
 * Client -> Torrent -> Peers
 */
@autoInjectable()
export class Client {
  private readonly torrents: Array<TorrentManager> = [];

  constructor(@inject('IHashService') private hashService?: IHashService) {}

  /**
   * Adds a torrent to be seeded or leeched. If you add files, you are a seeder, if you pass undefined, you are a leech
   * @param {MetainfoFile} metainfo
   * @param {Array<DiskFile> | undefined} files
   */
  public addTorrent = (metainfo: MetainfoFile, files: Array<DiskFile> | undefined) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.torrents.push(new TorrentManager(this.hashService!, metainfo, files));
  };
}
