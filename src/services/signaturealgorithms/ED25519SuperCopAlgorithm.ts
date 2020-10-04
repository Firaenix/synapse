import supercop from 'supercop.wasm';

import { ED25519KeyPair } from '../../models/ED25519KeyPair';
import { ISigningAlgorithm, KeyPair, SupportedSignatureAlgorithms } from '../interfaces/ISigningAlgorithm';

export class ED25519SuperCopAlgorithm implements ISigningAlgorithm {
  public readonly algorithm = SupportedSignatureAlgorithms.ed25519;
  public isInitialised = false;

  public static build = () =>
    new Promise<ED25519SuperCopAlgorithm>((res, reject) => {
      try {
        supercop.ready(() => {
          const algo = new ED25519SuperCopAlgorithm();
          algo.isInitialised = true;
          res(algo);
        });
      } catch (error) {
        reject(error);
      }
    });

  public sign = async (message: Buffer, privateKey: Buffer, publicKey?: Buffer) => {
    return this.signSync(message, privateKey, publicKey);
  };

  public signSync = (message: Buffer, privateKey: Buffer, publicKey?: Buffer) => {
    if (!this.isInitialised) {
      throw new Error('Supercop not initialised');
    }

    const signed = supercop.sign(message, publicKey, privateKey);
    return Buffer.from(signed);
  };

  public verify = async (message: Buffer, signature: Buffer, publicKey: Buffer) => {
    return this.verifySync(message, signature, publicKey);
  };

  public verifySync = (message: Buffer, signature: Buffer, publicKey: Buffer) => {
    if (!this.isInitialised) {
      throw new Error('Supercop not initialised');
    }
    const verified = supercop.verify(signature, message, publicKey);
    return verified;
  };

  public generateKeyPair = async (seed?: Buffer) => {
    return this.generateKeyPairSync(seed);
  };

  public generateKeyPairSync = (seed?: Buffer): KeyPair => {
    if (!this.isInitialised) {
      throw new Error('Supercop not initialised');
    }
    seed = seed ?? supercop.createSeed();
    const keys = supercop.createKeyPair(seed);

    const keypair = new ED25519KeyPair(Buffer.from(keys.publicKey), Buffer.from(keys.secretKey));

    const isvalid = keypair.isValidKeyPair();
    if (isvalid === false) {
      throw new Error('Did not create a valid keypair');
    }

    return keypair;
  };
}
