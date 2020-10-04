import supercop from 'supercop.wasm';

import { KeyPair } from '../services/interfaces/ISigningAlgorithm';

export class ED25519KeyPair implements KeyPair {
  public readonly publicKey: Buffer;
  public readonly secretKey: Buffer;

  constructor(publicKey: Buffer, secretKey: Buffer) {
    this.publicKey = publicKey;
    this.secretKey = secretKey;

    if (this.isValidKeyPair() === false) {
      throw new Error('Not a valid keypair');
    }
  }

  public static create = async (publicKey: Buffer, secretKey: Buffer) =>
    new Promise((resolve, reject) => {
      try {
        supercop.ready(() => {
          resolve(new ED25519KeyPair(publicKey, secretKey));
        });
      } catch (error) {
        reject(error);
      }
    });

  public isValidKeyPair = (): boolean => {
    const msg = Buffer.from('TEST MESSAGE');
    const sig: Buffer = supercop.sign(msg, this.publicKey, this.secretKey);

    const isVerified: boolean = supercop.verify(sig, msg, this.publicKey);
    return isVerified;
  };
}
