import { KeyPair } from '@firaenix/synapse-core';
import supercop from 'supercop';

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
    const signedTestMessage = await supercop.sign(msg, this.publicKey, this.secretKey);

    console.log('signedTestMessage', supercop, signedTestMessage);
    const sig: Buffer = Buffer.from(signedTestMessage);

    const isVerified: boolean = await supercop.verify(sig, msg, this.publicKey);
    return isVerified;
  };
}
