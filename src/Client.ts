import Wire, { Extension } from '@firaenix/bittorrent-protocol';
import { autoInjectable, container, DependencyContainer, inject } from 'tsyringe';

import { MetadataExtension } from './extensions/Metadata';
import { DiskFile } from './models/DiskFile';
import { MetainfoFile, SignedMetainfoFile } from './models/MetainfoFile';
import { SupportedHashAlgorithms } from './models/SupportedHashAlgorithms';
import { HashService, IHashService } from './services/HashService';
import { ILogger } from './services/interfaces/ILogger';
import { SupportedSignatureAlgorithms } from './services/interfaces/ISigningAlgorithm';
import { ISigningService } from './services/interfaces/ISigningService';
import { ConsoleLogger } from './services/LogLevelLogger';
import { MetaInfoService } from './services/MetaInfoService';
import { PeerManager } from './services/PeerManager';
import { ClassicNetworkPeerStrategy } from './services/peerstrategies/ClassicNetworkPeerStrategy';
import { WebRTCPeerStrategy } from './services/peerstrategies/WebRTCPeerStrategy';
import { PieceManager } from './services/PieceManager';
import { ED25519SuperCopAlgorithm } from './services/signaturealgorithms/ED25519SuperCopAlgorithm';
import { SigningService } from './services/SigningService';
import { TorrentDiscovery } from './services/TorrentDiscovery';
import { TorrentManager } from './services/TorrentManager';
import { createMetaInfo } from './utils/createMetaInfo';
import { diskFilesToChunks } from './utils/diskFilesToChunks';

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

  container.register('ISigningService', {
    useClass: SigningService
  });

  container.register('ISigningAlgorithm', {
    useClass: ED25519SuperCopAlgorithm
  });

  container.register(ED25519SuperCopAlgorithm, {
    useClass: ED25519SuperCopAlgorithm
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

  constructor(@inject('IHashService') private hashService?: IHashService, @inject('ISigningService') private readonly signingService?: ISigningService) {}

  generateMetaInfo(diskFiles: DiskFile[], torrentName: string, hashalgo?: SupportedHashAlgorithms): Promise<MetainfoFile>;
  generateMetaInfo(diskFiles: DiskFile[], torrentName: string, hashalgo?: SupportedHashAlgorithms, privateKeyBuffer?: Buffer, publicKeyBuffer?: Buffer): Promise<SignedMetainfoFile>;
  public async generateMetaInfo(diskFiles: DiskFile[], torrentName: string, hashalgo?: SupportedHashAlgorithms, privateKeyBuffer?: Buffer, publicKeyBuffer?: Buffer) {
    const metainfo = createMetaInfo(diskFiles, torrentName, hashalgo);

    if (privateKeyBuffer && publicKeyBuffer) {
      const signature = await this.signingService?.sign(metainfo.infohash, SupportedSignatureAlgorithms.ed25519, privateKeyBuffer, publicKeyBuffer);

      return {
        ...metainfo,
        infosig: signature,
        'infosig algo': signature ? SupportedSignatureAlgorithms.ed25519 : undefined,
        'pub key': Buffer.from(publicKeyBuffer)
      } as SignedMetainfoFile;
    }

    return metainfo;
  }

  /**
   * Adds a torrent to be seeded or leeched. If you add files, you are a seeder, if you pass undefined, you are a leech
   * @param {MetainfoFile} metainfo
   * @param {Array<DiskFile> | undefined} files
   */
  public addTorrentByMetainfo = (metainfo: MetainfoFile, files: Array<DiskFile> = []) => {
    const requestContainer = this.registerScopedDependencies(metainfo, files);
    requestContainer.register('ILogger', {
      useFactory: (ioc) => new ConsoleLogger()
    });

    requestContainer.register('IExtension', {
      useFactory: (ioc) => (w: Wire) =>
        new MetadataExtension(
          w,
          ioc.resolve(MetaInfoService).infoIdentifier!,
          ioc.resolve(MetaInfoService),
          ioc.resolve<IHashService>('IHashService'),
          ioc.resolve<ISigningService>('ISigningService'),
          ioc.resolve<ILogger>('ILogger')
        )
    });

    const torrentManager = requestContainer.resolve(TorrentManager);

    torrentManager.addTorrent(metainfo);

    this.torrents.push(torrentManager);
    return torrentManager;
  };

  public addTorrentByInfoHash = async (infoHash: Buffer) => {
    const requestContainer = this.registerScopedDependencies(undefined, []);
    requestContainer.register('ILogger', {
      useFactory: (ioc) => new ConsoleLogger()
    });

    requestContainer.register('IExtension', {
      useFactory: (ioc) => (w: Wire) =>
        new MetadataExtension(w, infoHash, ioc.resolve(MetaInfoService), ioc.resolve<IHashService>('IHashService'), ioc.resolve<ISigningService>('ISigningService'), ioc.resolve<ILogger>('ILogger'))
    });

    const discovery = requestContainer.resolve<TorrentDiscovery>('ITorrentDiscovery');
    const metainfo = await discovery.discoverByInfoHash(infoHash);

    const torrentManager = requestContainer.resolve(TorrentManager);

    torrentManager.addTorrent(metainfo);
    this.torrents.push(torrentManager);
    return torrentManager;
  };

  public addTorrentByInfoSig = async (infoSig: Buffer) => {
    const requestContainer = this.registerScopedDependencies(undefined, []);
    requestContainer.register('ILogger', {
      useFactory: (ioc) => new ConsoleLogger()
    });

    requestContainer.register('IExtension', {
      useFactory: (ioc) => (w: Wire) =>
        new MetadataExtension(w, infoSig, ioc.resolve(MetaInfoService), ioc.resolve<IHashService>('IHashService'), ioc.resolve<ISigningService>('ISigningService'), ioc.resolve<ILogger>('ILogger'))
    });

    const discovery = requestContainer.resolve<TorrentDiscovery>('ITorrentDiscovery');
    const metainfo = await discovery.discoverByInfoSig(infoSig);

    const torrentManager = requestContainer.resolve(TorrentManager);

    torrentManager.addTorrent(metainfo);
    this.torrents.push(torrentManager);
    return torrentManager;
  };

  private registerScopedDependencies = (metainfo: MetainfoFile | undefined, files: Array<DiskFile>): DependencyContainer => {
    const requestContainer = container.createChildContainer();

    requestContainer.register(PieceManager, {
      useClass: PieceManager
    });

    requestContainer.register(PeerManager, {
      useClass: PeerManager
    });

    requestContainer.register('ITorrentDiscovery', {
      useClass: TorrentDiscovery
    });

    let fileChunks: Array<Buffer> = [];
    if (metainfo) {
      fileChunks = diskFilesToChunks(files, metainfo.info['piece length']);
    }

    requestContainer.registerInstance(MetaInfoService, new MetaInfoService(metainfo, fileChunks));

    return requestContainer;
  };
}
