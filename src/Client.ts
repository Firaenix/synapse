import { MetainfoFile } from './models/MetainfoFile';
import { Extension } from '@firaenix/bittorrent-protocol';
import { HashService, IHashService } from './services/HashService';
import { DiskFile, DownloadedFile } from './models/DiskFile';
import { TorrentManager } from './services/TorrentManager';
import { container, autoInjectable, inject, predicateAwareClassFactory } from 'tsyringe';
import { ClassicNetworkPeerStrategy } from './services/ClassicNetworkPeerStrategy';
import { WebRTCPeerStrategy } from './services/WebRTCPeerStrategy';
import { PieceManager } from './services/PieceManager';
import { PeerManager } from './services/PeerManager';
import { chunkBuffer } from './utils/chunkBuffer';
import { MetaInfoService } from './services/MetaInfoService';

export interface Settings {
  extensions?: Extension[];
}

const defaultSettings: Settings = {
  // Add Bitcoin, ECDH
  extensions: []
};

const registerDependencies = () => {
  container.register('IHashService', {
    useClass: HashService
  });

  container.register('IPeerStrategy', {
    useClass: ClassicNetworkPeerStrategy
  });

  container.register('IPeerStrategy', {
    useClass: WebRTCPeerStrategy
  });
};

registerDependencies();

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
  public addTorrent = (metainfo: MetainfoFile, files: Array<DiskFile> = [], onDownloadedCallback?: (downloads: Array<DownloadedFile>) => void) => {
    const requestContainer = container.createChildContainer();

    requestContainer.register(PieceManager, {
      useClass: PieceManager
    });

    requestContainer.register(PeerManager, {
      useClass: PeerManager
    });

    let fileChunks: Array<Buffer> = [];
    if (files) {
      fileChunks = files.map((x) => chunkBuffer(x.file, metainfo.info['piece length'])).flat();
    }

    requestContainer.registerInstance(MetaInfoService, new MetaInfoService(metainfo, fileChunks));

    const torrentManager = requestContainer.resolve(TorrentManager);

    torrentManager.startTorrent(onDownloadedCallback);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.torrents.push(torrentManager);
  };
}
