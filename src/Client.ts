import { MetainfoFile, SignedMetainfoFile } from './models/MetainfoFile';
import { Extension } from '@firaenix/bittorrent-protocol';
import { HashService, IHashService } from './services/HashService';
import { DiskFile } from './models/DiskFile';
import { TorrentManager } from './services/TorrentManager';
import { container, autoInjectable, inject } from 'tsyringe';
import { ClassicNetworkPeerStrategy } from './services/peerstrategies/ClassicNetworkPeerStrategy';
import { WebRTCPeerStrategy } from './services/peerstrategies/WebRTCPeerStrategy';
import { PieceManager } from './services/PieceManager';
import { PeerManager } from './services/PeerManager';
import { chunkBuffer } from './utils/chunkBuffer';
import { MetaInfoService } from './services/MetaInfoService';
import { createMetaInfo } from './utils/createMetaInfo';
import { SupportedHashAlgorithms } from './models/SupportedHashAlgorithms';
import { ISigningService } from './services/interfaces/ISigningService';
import { SigningService } from './services/SigningService';
import { SupportedSignatureAlgorithms } from './services/interfaces/ISigningAlgorithm';
import { ED25519SuperCopAlgorithm } from './services/signaturealgorithms/ED25519SuperCopAlgorithm';

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

    if (privateKeyBuffer) {
      const signature = await this.signingService?.sign(metainfo.infohash, SupportedSignatureAlgorithms.ed25519, privateKeyBuffer, publicKeyBuffer);

      return {
        ...metainfo,
        infosig: signature,
        'infosig algo': signature ? SupportedSignatureAlgorithms.ed25519 : undefined,
        'pub key': Buffer.from('should be pub key')
      } as SignedMetainfoFile;
    }

    return metainfo;
  }

  /**
   * Adds a torrent to be seeded or leeched. If you add files, you are a seeder, if you pass undefined, you are a leech
   * @param {MetainfoFile} metainfo
   * @param {Array<DiskFile> | undefined} files
   */
  public addTorrent = (metainfo: MetainfoFile, files: Array<DiskFile> = []) => {
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

    torrentManager.addTorrent(metainfo);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.torrents.push(torrentManager);
    return torrentManager;
  };
}
