import supercop from 'supercop';

import { KeyPair } from '../services/interfaces/ISigningAlgorithm';

export class ED25519KeyPair implements KeyPair {
  public readonly publicKey: Buffer;
  public readonly secretKey: Buffer;

  constructor(publicKey: Buffer, secretKey: Buffer) {
    this.publicKey = Buffer.from(publicKey);
    this.secretKey = Buffer.from(secretKey);
  }

  public static create = async (publicKey: Buffer, secretKey: Buffer) =>
    new Promise((resolve, reject) => {
      try {
        const keyPair = new ED25519KeyPair(publicKey, secretKey);
        keyPair.isValidKeyPair().then((isValid) => {
          if (isValid === false) {
            reject(new Error('Not a valid keypair'));
          }

          resolve(keyPair);
        });
      } catch (error) {
        reject(error);
      }
    });

  public isValidKeyPair = async (): Promise<boolean> => {
    const msg = Buffer.from('TEST MESSAGE');
    const sslkdfasd = await supercop.sign(msg, this.publicKey, this.secretKey);

    console.log('sslkdfasd', supercop, sslkdfasd);
    const sig: Buffer = Buffer.from(sslkdfasd);

    const isVerified: boolean = await supercop.verify(sig, msg, this.publicKey);
    return isVerified;
  };
}
