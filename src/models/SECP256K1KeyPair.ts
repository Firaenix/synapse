import secp256k1 from 'secp256k1';

import { KeyPair } from '../services/interfaces/ISigningAlgorithm';

export class SECP256K1KeyPair implements KeyPair {
  public readonly publicKey: Buffer;
  public readonly secretKey: Buffer;

  constructor(publicKey: Buffer, secretKey: Buffer) {
    if (this.isValidKeyPairSync(publicKey, secretKey) === false) {
      throw new Error('Not a valid keypair');
    }

    this.publicKey = publicKey;
    this.secretKey = secretKey;
  }

  private isValidKeyPairSync = (publicKey: Buffer, secretKey: Buffer): boolean => {
    try {
      const isValidPrivate = secp256k1.privateKeyVerify(secretKey);
      const isValidPublic = secp256k1.publicKeyVerify(publicKey);

      const testPubKey = Buffer.from(secp256k1.publicKeyCreate(secretKey));
      const isActualPubKey = publicKey.equals(testPubKey);
      return isValidPrivate && isValidPublic && isActualPubKey;
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  public isValidKeyPair = async (): Promise<boolean> => {
    return this.isValidKeyPairSync(this.publicKey, this.secretKey);
  };
}
