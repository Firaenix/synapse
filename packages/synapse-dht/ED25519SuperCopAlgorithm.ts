import { ISigningAlgorithm, SupportedSignatureAlgorithms } from '@firaenix/synapse-core/lib/interfaces/ISigningAlgorithm';
import { ED25519KeyPair } from '@firaenix/synapse-core/lib/models/ED25519KeyPair';
import supercop from 'supercop';

export class ED25519SuperCopAlgorithm implements ISigningAlgorithm {
  public readonly algorithm = SupportedSignatureAlgorithms.ed25519;
  public isInitialised = false;

  public static build = () =>
    new Promise<ED25519SuperCopAlgorithm>((res, reject) => {
      try {
        const algo = new ED25519SuperCopAlgorithm();
        algo.isInitialised = true;
        res(algo);
      } catch (error) {
        reject(error);
      }
    });

  public sign = async (message: Buffer, privateKey: Buffer, publicKey?: Buffer) => {
    const signed = await supercop.sign(message, publicKey, privateKey);
    return Buffer.from(signed);
  };

  public signSync = (message: Buffer, privateKey: Buffer, publicKey?: Buffer) => {
    const signed = this.makeSync(this.sign(message, privateKey, publicKey));
    return signed;
  };

  private makeSync = <T>(promise: Promise<T>) => {
    let asyncValue: T | undefined = undefined;
    promise.then((value) => {
      asyncValue = value;
    });

    while (!asyncValue) {
      // console.log('Waiting for p');
    }

    return asyncValue;
  };

  public verify = async (message: Buffer, signature: Buffer, publicKey: Buffer) => {
    if (!this.isInitialised) {
      throw new Error('Supercop not initialised');
    }

    console.log('verifying message', message, signature, publicKey);
    const verified = await supercop.verify(signature, message, publicKey);
    return verified;
  };

  public verifySync = (message: Buffer, signature: Buffer, publicKey: Buffer) => {
    const isValid = this.makeSync(this.verify(message, signature, publicKey));
    return isValid;
  };

  public generateKeyPair = async (seed?: Buffer) => {
    if (!this.isInitialised) {
      throw new Error('Supercop not initialised');
    }
    seed = seed ?? supercop.createSeed();
    const keys = supercop.createKeyPair(seed);

    const keypair = new ED25519KeyPair(Buffer.from(keys.publicKey), Buffer.from(keys.secretKey));

    const isvalid = await keypair.isValidKeyPair();
    if (isvalid === false) {
      throw new Error('Did not create a valid keypair');
    }

    return keypair;
  };
}