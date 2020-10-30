import { SupportedSignatureAlgorithms, KeyPair } from './ISigningAlgorithm';
export interface ISigningService {
  sign(data: Buffer, supportedSignatureAlgos: SupportedSignatureAlgorithms, privateKey: Buffer, publicKey?: Buffer): Promise<Buffer>;
  generateKeyPair(supportedSignatureAlgos: SupportedSignatureAlgorithms): Promise<KeyPair>;
  verify(message: Buffer, signature: Buffer, publicKey: Buffer, supportedSignatureAlgos: SupportedSignatureAlgorithms): Promise<boolean>;
}
