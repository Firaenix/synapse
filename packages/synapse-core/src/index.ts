import { Client as Client2 } from './Client';

export { ConsoleLogger } from './services/LogLevelLogger';
export { CreateFilesFromPaths } from './utils/CreateFilesFromPaths';
export { SECP256K1KeyPair } from './models/SECP256K1KeyPair';
export { SECP256K1SignatureAlgorithm } from './services/signaturealgorithms/SECP256K1SignatureAlgorithm';
export { SignedMetainfoFile } from './models/MetainfoFile';
export { SupportedHashAlgorithms } from './models/SupportedHashAlgorithms';

export { SigningAlgorithmName } from './services/interfaces/ISigningService';

export { IHashService } from './services/HashService';

export { IHashAlgorithm } from './services/interfaces/IHashAlgorithm';
export { ISigningAlgorithm } from './services/interfaces/ISigningAlgorithm';
export { KeyPair } from './services/interfaces/ISigningAlgorithm';
export { Metainfo } from './models/Metainfo';
export { MetainfoFile } from './models/MetainfoFile';
export { SHA1HashAlgorithm } from './services/hashalgorithms/SHA1HashAlgorithm';
export { SHA256HashAlgorithm } from './services/hashalgorithms/SHA256HashAlgorithm';
export { HashService } from './services/HashService';
export { SigningService } from './services/SigningService';
export { StreamDownloadService } from './services/StreamDownloadService';
export { TorrentDiscovery } from './services/TorrentDiscovery';
export { TorrentManager } from './services/TorrentManager';
export { ILogger } from './services/interfaces/ILogger';
export { IPeerStrategy } from './services/interfaces/IPeerStrategy';
export { ITorrentDiscovery } from './services/interfaces/ITorrentDiscovery';
export { MetadataExtension } from './extensions/Metadata';

export { Client } from './Client';

const Client = Client2;
export default Client;
global['Client'] = Client;
