import supercop from 'supercop.wasm';

import { KeyPair } from '../services/interfaces/ISigningAlgorithm';

export class ED25519KeyPair implements KeyPair {
  public readonly publicKey: Buffer;
  public readonly secretKey: Buffer;

  constructor(publicKey: Buffer, secretKey: Buffer) {
    this.publicKey = publicKey;
    this.secretKey = secretKey;
  }

  public isValidKeyPair = async (): Promise<boolean> =>
    new Promise<boolean>((resolve, reject) => {
      try {
        supercop.ready(() => {
          try {
            const msg = Buffer.from('TEST MESSAGE');
            const sig: Buffer = supercop.sign(msg, this.publicKey, this.secretKey);

            const isVerified: boolean = supercop.verify(sig, msg, this.publicKey);
            resolve(isVerified);
          } catch (error) {
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
}
