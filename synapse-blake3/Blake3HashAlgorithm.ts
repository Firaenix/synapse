import * as blake3 from 'blake3';
import { IHashAlgorithm } from 'synapse-core/src/services/interfaces/IHashAlgorithm';

export class Blake3HashAlgorithm implements IHashAlgorithm {
  public algorithm = 'blake3';

  constructor(private readonly blakeHasher: blake3.IHasher<any>) {

  }
  public hash = (msg: Buffer): Buffer =>  {
    return Buffer.from(this.blakeHasher.update(msg).digest());
  };

  public static build = new Promise<Blake3HashAlgorithm>((resolve, reject) => {
    if (window) {
      import('blake3/browser').then(blake => {
        resolve(new Blake3HashAlgorithm(blake.createHash()));
      }).catch(reject);
    }
    else {
      resolve(new Blake3HashAlgorithm(blake3.createHash()));
    }
  });
}