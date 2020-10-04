import supercop from 'supercop.wasm';

import { ED25519KeyPair } from '../../models/ED25519KeyPair';
import { ISigningAlgorithm, KeyPair, SupportedSignatureAlgorithms } from '../interfaces/ISigningAlgorithm';

export class ED25519SuperCopAlgorithm implements ISigningAlgorithm {
  public readonly algorithm = SupportedSignatureAlgorithms.ed25519;

  public sign = (message: Buffer, privateKey: Buffer, publicKey?: Buffer) =>
    new Promise<Buffer>((res, reject) => {
      supercop.ready(() => {
        try {
          const signed = supercop.sign(message, publicKey, privateKey);
          res(Buffer.from(signed));
        } catch (error) {
          reject(error);
        }
      });
    });

  public verify = (message: Buffer, signature: Buffer, publicKey: Buffer) =>
    new Promise<boolean>((res, reject) => {
      supercop.ready(() => {
        try {
          const verified = supercop.verify(signature, message, publicKey);
          res(verified);
        } catch (error) {
          reject(error);
        }
      });
    });

  public generateKeyPair = (seed?: Buffer): Promise<KeyPair> =>
    new Promise<KeyPair>((res, reject) => {
      supercop.ready(async () => {
        try {
          seed = seed ?? supercop.createSeed();
          const keys = supercop.createKeyPair(seed);

          const keypair = new ED25519KeyPair(Buffer.from(keys.publicKey), Buffer.from(keys.secretKey));

          const isvalid = await keypair.isValidKeyPair();
          if (isvalid === false) {
            return reject(new Error('Did not generate a valid keypair'));
          }

          res(keypair);
        } catch (error) {
          reject(error);
        }
      });
    });
}
