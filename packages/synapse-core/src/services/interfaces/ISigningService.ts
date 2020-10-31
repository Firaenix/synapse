import { KeyPair, SupportedSignatureAlgorithms } from './ISigningAlgorithm';

export type SigningAlgorithmName = SupportedSignatureAlgorithms | string;

export interface ISigningService {
  sign(data: Buffer, supportedSignatureAlgos: SigningAlgorithmName, privateKey: Buffer, publicKey?: Buffer): Promise<Buffer>;
  generateKeyPair(supportedSignatureAlgos: SigningAlgorithmName): Promise<KeyPair>;
  verify(message: Buffer, signature: Buffer, publicKey: Buffer, supportedSignatureAlgos: SigningAlgorithmName): Promise<boolean>;
}
