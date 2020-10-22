import Wire from '@firaenix/bittorrent-protocol';
import { container, DependencyContainer } from 'tsyringe';

import { MetadataExtension } from './extensions/Metadata';
import { DiskFile } from './models/DiskFile';
import { InjectedExtension } from './models/InjectedExtensions';
import { isSignedMetainfo, MetainfoFile, SignedMetainfoFile } from './models/MetainfoFile';
import { SupportedHashAlgorithms } from './models/SupportedHashAlgorithms';
import { DHTService } from './services/DHTService';
import { SHA1HashAlgorithm } from './services/hashalgorithms/SHA1HashAlgorithm';
import { SHA256HashAlgorithm } from './services/hashalgorithms/SHA256HashAlgorithm';
import { HashService, IHashService } from './services/HashService';
import { ILogger } from './services/interfaces/ILogger';
import { KeyPair, SupportedSignatureAlgorithms } from './services/interfaces/ISigningAlgorithm';
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
  extensions: ((ioc: DependencyContainer) => InjectedExtension)[];
}

const defaultExtensions = [
  (ioc: DependencyContainer) => (w: Wire, infoId: Buffer, metainfo?: MetainfoFile) =>
    new MetadataExtension(w, infoId, metainfo, ioc.resolve<IHashService>('IHashService'), ioc.resolve<ISigningService>('ISigningService'), ioc.resolve<ILogger>('ILogger'))
];

const defaultSettings: Settings = {
  extensions: defaultExtensions
};

/**
 * Manages the instances of torrents we want to download and seed
 * Client -> Torrent -> Peers
 */
export class Client {
  private readonly torrents: Map<Buffer, TorrentManager> = new Map();
  private hashService: IHashService;
  private readonly signingService: ISigningService;
  private readonly settings: Settings;

  constructor(settings: Settings = defaultSettings) {
    this.settings = {
      ...defaultSettings,
      ...settings,
      extensions: [...settings.extensions, ...defaultSettings.extensions]
    };
    this.hashService = container.resolve('IHashService');
    this.signingService = container.resolve('ISigningService');
  }

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

  public stopAllTorrents = async () => {
    for await (const [_, torrent] of this.torrents.entries()) {
      await torrent.stopTorrent();
    }
  };

  /**
   * Stop seeding the existing torrent and replace with a new metainfo file.
   * Start seeding that torrent.
   * @param {TorrentManager} currentTorrent
   * @param {SignedMetainfoFile} metainfo
   * @param {KeyPair} keyPair
   * @param {Array<DiskFile>} files
   */
  public updateTorrent = async (currentTorrent: TorrentManager, metainfo: SignedMetainfoFile, keyPair?: KeyPair, files: Array<DiskFile> = []) => {
    if (!isSignedMetainfo(currentTorrent.metainfo)) {
      throw new Error('Must be a signed metainfo file to allow updates');
    }

    const existingTorrent = this.torrents.get(currentTorrent.metainfo.infosig);
    if (!existingTorrent) {
      throw new Error(`No torrent exists with that id: ${currentTorrent.id}`);
    }

    // await existingTorrent.stopTorrent();

    const newTorrent = await this.addTorrentByMetainfo(metainfo, keyPair, files);

    this.torrents.delete(currentTorrent.metainfo.infosig);
    return newTorrent;
  };

  /**
   * Adds a torrent to be seeded or leeched. If you add files, you are a seeder, if you pass undefined, you are a leech
   * @param {MetainfoFile} metainfo
   * @param {Array<DiskFile> | undefined} files
   */
  public addTorrentByMetainfo = async (metainfo: MetainfoFile, keyPair?: KeyPair, files: Array<DiskFile> = []) => {
    try {
      let requestContainer = this.registerScopedDependencies(metainfo, files);

      requestContainer = await this.registerExtensions(requestContainer);

      const torrentManager = requestContainer.resolve(TorrentManager);

      torrentManager.addTorrent(metainfo, keyPair);

      const infoId = requestContainer.resolve(MetaInfoService).infoIdentifier;
      if (!infoId) {
        throw new Error('How did we create a torrent without an infoId?');
      }

      this.torrents.set(infoId, torrentManager);
      return torrentManager;
    } catch (error) {
      console.error(error);
      throw error;
    }
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
    this.torrents.set(infoIdentifier, torrentManager);
    return torrentManager;
  };

  private registerScopedDependencies = (metainfo: MetainfoFile | undefined, files: Array<DiskFile>): DependencyContainer => {
    const requestContainer = container.createChildContainer();

    requestContainer.registerSingleton(PieceManager);

    requestContainer.registerSingleton('ILogger', ConsoleLogger);

    requestContainer.register(PeerManager, PeerManager);

    requestContainer.register('ITorrentDiscovery', TorrentDiscovery);

    requestContainer.registerSingleton(DHTService);

    let fileChunks: Array<Buffer> = [];
    if (metainfo) {
      fileChunks = diskFilesToChunks(files, metainfo.info['piece length']);
    }

    requestContainer.registerInstance(MetaInfoService, new MetaInfoService(metainfo, fileChunks));

    return requestContainer;
  };

  public static registerDependencies = async () => {
    container.register('IHashService', HashService);

    container.register('ISigningService', SigningService);

    const superCopAlgo = await ED25519SuperCopAlgorithm.build();
    container.registerInstance('ISigningAlgorithm', superCopAlgo);
    container.registerInstance(ED25519SuperCopAlgorithm, superCopAlgo);

    container.register('ISigningAlgorithm', SECP256K1SignatureAlgorithm);
    container.register(SECP256K1SignatureAlgorithm, SECP256K1SignatureAlgorithm);

    container.register('IHashAlgorithm', SHA1HashAlgorithm);
    container.register(SHA1HashAlgorithm, SHA1HashAlgorithm);

    container.register('IHashAlgorithm', SHA256HashAlgorithm);
    container.register(SHA256HashAlgorithm, SHA256HashAlgorithm);

    container.register('IPeerStrategy', ClassicNetworkPeerStrategy);
    container.register('IPeerStrategy', WebRTCPeerStrategy);
  };

  private registerExtensions = async (requestContainer: DependencyContainer): Promise<DependencyContainer> => {
    const infoIdentifier = requestContainer.resolve(MetaInfoService).infoIdentifier;
    if (!infoIdentifier) {
      throw new Error('Cant add torrent if we dont have an InfoID');
    }

    for (const extension of this.settings.extensions) {
      requestContainer.register('IExtension', {
        useValue: extension(requestContainer)
      });
    }

    return requestContainer;
  };
}
