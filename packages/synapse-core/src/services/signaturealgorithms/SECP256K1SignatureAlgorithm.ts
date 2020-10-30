import { randomBytes } from 'crypto';
import secp256k1 from 'secp256k1';
import { inject, injectable } from 'tsyringe';

import { SECP256K1KeyPair } from '../../models/SECP256K1KeyPair';
import { SupportedHashAlgorithms } from '../../models/SupportedHashAlgorithms';
import { IHashService } from '../HashService';
import { ISigningAlgorithm, KeyPair, SupportedSignatureAlgorithms } from '../interfaces/ISigningAlgorithm';

@injectable()
export class SECP256K1SignatureAlgorithm implements ISigningAlgorithm {
  public readonly algorithm = SupportedSignatureAlgorithms.secp256k1;

  constructor(@inject('IHashService') private readonly hashService: IHashService) {}

  public sign = async (message: Buffer, privateKey: Buffer, publicKey?: Buffer) => {
    // secp256k1 requires you to hash before sign, handled externally
    const hashMsg = await this.hashService.hash(message, SupportedHashAlgorithms.sha256);
    const sigObj = secp256k1.ecdsaSign(hashMsg, privateKey);
    return Buffer.from(sigObj.signature);
  };

  public verify = async (message: Buffer, signature: Buffer, publicKey: Buffer) => {
    // secp256k1 requires you to hash before sign, handled externally
    const hashMsg = await this.hashService.hash(message, SupportedHashAlgorithms.sha256);
    return secp256k1.ecdsaVerify(Buffer.from(signature), hashMsg, publicKey);
  };

  public generateKeyPair = (): Promise<KeyPair> => {
    let privKey: Buffer;
    do {
      privKey = randomBytes(32);
    } while (!secp256k1.privateKeyVerify(privKey));

    // get the public key in a compressed format
    const pubKey = Buffer.from(secp256k1.publicKeyCreate(privKey));
    const secretKey = Buffer.from(privKey);

    const keyPair = new SECP256K1KeyPair(pubKey, secretKey);
    return Promise.resolve(keyPair);
  };
}
