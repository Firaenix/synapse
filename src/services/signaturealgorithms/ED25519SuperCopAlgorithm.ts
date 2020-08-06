import { ISigningAlgorithm, SupportedSignatureAlgorithms, KeyPair } from '../interfaces/ISigningAlgorithm';
import supercop from 'ed25519-supercop';

export class ED25519SuperCopAlgorithm implements ISigningAlgorithm {
  public readonly algorithm = SupportedSignatureAlgorithms.ed25519;

  public sign = (message: Buffer, privateKey: Buffer, publicKey?: Buffer) => {
    return Promise.resolve(supercop.sign(message, publicKey, privateKey));
  };

  public verify = (message: Buffer, signature: Buffer, publicKey: Buffer) => {
    return Promise.resolve(supercop.verify(signature, message, publicKey));
  };

  public generateKeyPair = (): Promise<KeyPair> => {
    const seed = supercop.createSeed();
    const keys = supercop.createKeyPair(seed);
    return Promise.resolve({ publicKey: Buffer.from(keys.publicKey), secretKey: Buffer.from(keys.secretKey) });
  };
}
