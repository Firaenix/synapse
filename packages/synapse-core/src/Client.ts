import Wire from '@firaenix/bittorrent-protocol';
import { container, DependencyContainer } from 'tsyringe';

import { ArgumentNullError } from './errors/ArgumentNullError';
import { MetadataExtension } from './extensions/Metadata';
import { DiskFile } from './models/DiskFile';
import { InjectedExtension } from './models/InjectedExtensions';
import { isSignedMetainfo, MetainfoFile, SignedMetainfoFile } from './models/MetainfoFile';
import { SupportedHashAlgorithms } from './models/SupportedHashAlgorithms';
import { SHA1HashAlgorithm } from './services/hashalgorithms/SHA1HashAlgorithm';
import { SHA256HashAlgorithm } from './services/hashalgorithms/SHA256HashAlgorithm';
import { HashService, IHashService } from './services/HashService';
import { ILogger } from './services/interfaces/ILogger';
import { KeyPair } from './services/interfaces/ISigningAlgorithm';
import { ISigningService, SigningAlgorithmName } from './services/interfaces/ISigningService';
import { ConsoleLogger } from './services/LogLevelLogger';
import { MetaInfoService } from './services/MetaInfoService';
import { PeerManager } from './services/PeerManager';
import { PieceManager } from './services/PieceManager';
import { SECP256K1SignatureAlgorithm } from './services/signaturealgorithms/SECP256K1SignatureAlgorithm';
import { SigningService } from './services/SigningService';
import { TorrentDiscovery } from './services/TorrentDiscovery';
import { TorrentManager } from './services/TorrentManager';
import { createMetaInfo } from './utils/createMetaInfo';
import { diskFilesToChunks } from './utils/diskFilesToChunks';

export interface Settings {
  extensions: ((ioc: DependencyContainer) => InjectedExtension)[];
  registration?: (ioc: DependencyContainer) => Promise<DependencyContainer>;
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
  private readonly settings: Settings;
  private readonly _dependencyContainer: DependencyContainer;

  constructor(dependencyContainer: DependencyContainer, settings: Settings = defaultSettings) {
    this.settings = {
      ...defaultSettings,
      ...settings,
      extensions: [...settings.extensions, ...defaultSettings.extensions]
    };

    if (!dependencyContainer) throw new ArgumentNullError('dependencyContainer');

    this._dependencyContainer = dependencyContainer;
  }

  generateMetaInfo(diskFiles: DiskFile[], torrentName: string, hashalgo?: SupportedHashAlgorithms): Promise<MetainfoFile>;
  generateMetaInfo(
    diskFiles: DiskFile[],
    torrentName: string,
    hashalgo?: SupportedHashAlgorithms,
    signingAlgo?: SigningAlgorithmName,
    privateKeyBuffer?: Buffer,
    publicKeyBuffer?: Buffer
  ): Promise<SignedMetainfoFile>;
  public async generateMetaInfo(
    diskFiles: DiskFile[],
    torrentName: string,
    hashalgo?: SupportedHashAlgorithms,
    signingAlgo?: SigningAlgorithmName,
    privateKeyBuffer?: Buffer,
    publicKeyBuffer?: Buffer
  ) {
    const hashService = this._dependencyContainer.resolve<IHashService>('IHashService');
    const metainfo = await createMetaInfo(diskFiles, torrentName, hashalgo, hashService);

    if (privateKeyBuffer && publicKeyBuffer && signingAlgo) {
      const signingService = this._dependencyContainer.resolve<ISigningService>('ISigningService');
      const signature = await signingService.sign(metainfo.infohash, signingAlgo, privateKeyBuffer, publicKeyBuffer);

      return {
        ...metainfo,
        infosig: signature,
        'infosig algo': signature ? signingAlgo : undefined,
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
      let requestContainer = await this.registerScopedDependencies(metainfo, files);

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
    let requestContainer = await this.registerScopedDependencies(undefined, []);

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

  private registerScopedDependencies = async (metainfo: MetainfoFile | undefined, files: Array<DiskFile>): Promise<DependencyContainer> => {
    this._dependencyContainer.registerSingleton(PieceManager);

    this._dependencyContainer.registerSingleton('ILogger', ConsoleLogger);

    this._dependencyContainer.register(PeerManager, PeerManager);

    this._dependencyContainer.register('ITorrentDiscovery', TorrentDiscovery);

    let fileChunks: Array<Buffer> = [];
    if (metainfo) {
      fileChunks = diskFilesToChunks(files, metainfo.info['piece length']);
    }

    this._dependencyContainer.registerInstance(MetaInfoService, new MetaInfoService(metainfo, fileChunks));

    return this._dependencyContainer;
  };

  private registerExtensions = async (requestContainer: DependencyContainer): Promise<DependencyContainer> => {
    const infoIdentifier = requestContainer.resolve(MetaInfoService).infoIdentifier;
    if (!infoIdentifier) {
      throw new Error('Cant add torrent if we dont have an InfoID');
    }

    for (const extension of this.settings?.extensions ?? []) {
      requestContainer.register('IExtension', {
        useValue: extension(requestContainer)
      });
    }

    return requestContainer;
  };

  public static buildClient = async (settings?: Settings): Promise<Client> => {
    let globalContainer = container.createChildContainer();

    // Register Global Singletons
    globalContainer = await Client.registerGlobalSingletons(globalContainer);

    // Register User Defined registerDependencies
    globalContainer = (await settings?.registration?.(globalContainer)) ?? globalContainer;

    return new Client(globalContainer, settings);
  };

  private static registerGlobalSingletons = async (container: DependencyContainer) => {
    container.registerSingleton('IHashAlgorithm', SHA1HashAlgorithm);
    container.registerSingleton(SHA1HashAlgorithm, SHA1HashAlgorithm);

    container.registerSingleton('IHashAlgorithm', SHA256HashAlgorithm);
    container.registerSingleton(SHA256HashAlgorithm, SHA256HashAlgorithm);

    container.registerSingleton('IHashService', HashService);
    container.registerSingleton(HashService, HashService);

    container.registerSingleton('ISigningService', SigningService);
    container.registerSingleton(SigningService, SigningService);

    container.registerSingleton('ISigningAlgorithm', SECP256K1SignatureAlgorithm);
    container.registerSingleton(SECP256K1SignatureAlgorithm, SECP256K1SignatureAlgorithm);

    return container;
  };
}
