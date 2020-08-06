import { ISigningAlgorithm, SupportedSignatureAlgorithms, KeyPair } from '../interfaces/ISigningAlgorithm';
import elliptic from 'elliptic';

export class ED25519Algorithm implements ISigningAlgorithm {
  public readonly algorithm = SupportedSignatureAlgorithms.ed25519;
  private readonly _ed25519: elliptic.eddsa;

  constructor() {
    this._ed25519 = new elliptic.eddsa('ed25519');
  }

  public sign = (message: Buffer, privateKey: Buffer) => {
    return Promise.resolve(this._ed25519.sign(message, privateKey).toBytes());
  };

  public verify = (message: Buffer, signature: Buffer, publicKey: Buffer) => {
    return Promise.resolve(this._ed25519.verify(message, signature, publicKey));
  };

  public generateKeyPair = (): Promise<KeyPair> => {
    const randomBytes = elliptic.rand(64);
    const pair = this._ed25519.keyFromSecret(randomBytes);
    return Promise.resolve({ publicKey: Buffer.from(pair.getPublic()), secretKey: Buffer.from(pair.getSecret()) });
  };
}
