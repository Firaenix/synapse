import Wire, { Extension } from '@firaenix/bittorrent-protocol';
import { autoInjectable, container, DependencyContainer, inject } from 'tsyringe';

import { BitcoinExtension } from './extensions/Bitcoin';
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
import { SECP256K1SignatureAlgorithm } from './services/signaturealgorithms/SECP256K1SignatureAlgorithm';
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
  container.register('IHashService', HashService);

  container.register('ISigningService', SigningService);

  container.register('ISigningAlgorithm', ED25519SuperCopAlgorithm);
  container.register(ED25519SuperCopAlgorithm, ED25519SuperCopAlgorithm);

  container.register('ISigningAlgorithm', SECP256K1SignatureAlgorithm);
  container.register(SECP256K1SignatureAlgorithm, SECP256K1SignatureAlgorithm);

  container.register('IPeerStrategy', ClassicNetworkPeerStrategy);
  container.register('IPeerStrategy', WebRTCPeerStrategy);
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
  public addTorrentByMetainfo = async (metainfo: MetainfoFile, files: Array<DiskFile> = []) => {
    let requestContainer = this.registerScopedDependencies(metainfo, files);

    requestContainer = await this.registerExtensions(requestContainer);

    const torrentManager = requestContainer.resolve(TorrentManager);

    torrentManager.addTorrent(metainfo);

    this.torrents.push(torrentManager);
    return torrentManager;
  };

  public addTorrentByInfoHash = async (infoHash: Buffer) => {
    return this.addTorrentByInfoIdentifier(infoHash);
  };

  public addTorrentByInfoSig = async (infoSig: Buffer) => {
    return this.addTorrentByInfoIdentifier(infoSig);
  };

  private addTorrentByInfoIdentifier = async (infoIdentifier: Buffer) => {
    let requestContainer = this.registerScopedDependencies(undefined, []);

    const discovery = requestContainer.resolve<TorrentDiscovery>('ITorrentDiscovery');
    const metainfo = await discovery.discoverByInfoSig(infoIdentifier);

    // Set up metainfo service and extensions, so we can get going
    requestContainer.resolve(MetaInfoService).metainfo = metainfo;
    requestContainer = await this.registerExtensions(requestContainer);

    const torrentManager = requestContainer.resolve(TorrentManager);

    torrentManager.addTorrent(metainfo);
    this.torrents.push(torrentManager);
    return torrentManager;
  };

  private registerScopedDependencies = (metainfo: MetainfoFile | undefined, files: Array<DiskFile>): DependencyContainer => {
    const requestContainer = container.createChildContainer();

    requestContainer.registerSingleton(PieceManager);

    requestContainer.registerSingleton('ILogger', ConsoleLogger);

    requestContainer.register(PeerManager, PeerManager);

    requestContainer.register('ITorrentDiscovery', TorrentDiscovery);

    let fileChunks: Array<Buffer> = [];
    if (metainfo) {
      fileChunks = diskFilesToChunks(files, metainfo.info['piece length']);
    }

    requestContainer.registerInstance(MetaInfoService, new MetaInfoService(metainfo, fileChunks));

    return requestContainer;
  };

  private registerExtensions = async (requestContainer: DependencyContainer): Promise<DependencyContainer> => {
    const infoIdentifier = requestContainer.resolve(MetaInfoService).infoIdentifier;
    if (!infoIdentifier) {
      throw new Error('Cant add torrent if we dont have an InfoID');
    }

    requestContainer.register('IExtension', {
      useFactory: (ioc) => (w: Wire) =>
        new MetadataExtension(
          w,
          infoIdentifier,
          ioc.resolve(MetaInfoService),
          ioc.resolve<IHashService>('IHashService'),
          ioc.resolve<ISigningService>('ISigningService'),
          ioc.resolve<ILogger>('ILogger')
        )
    });

    const keyPair = await requestContainer.resolve(SECP256K1SignatureAlgorithm).generateKeyPair();

    requestContainer.register('IExtension', {
      useFactory: (ioc) => (w: Wire) =>
        new BitcoinExtension(
          w,
          {
            getPrice: (index, offset, length) => {
              // 1sat for every 10KB
              const kb = length / 1000;
              return Math.ceil(kb);
            },
            keyPair
          },
          ioc.resolve(SECP256K1SignatureAlgorithm),
          ioc.resolve<ILogger>('ILogger')
        )
    });

    return requestContainer;
  };
}
