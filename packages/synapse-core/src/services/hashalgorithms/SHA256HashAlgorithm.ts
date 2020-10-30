import { SupportedHashAlgorithms } from '../../models/SupportedHashAlgorithms';
import { CryptoHash } from '../HashService';
import { IHashAlgorithm } from '../interfaces/IHashAlgorithm';

export class SHA256HashAlgorithm implements IHashAlgorithm {
  private _hasher: (buf: Buffer) => Buffer;
  public algorithm = SupportedHashAlgorithms.sha256;

  constructor() {
    this._hasher = CryptoHash('sha256');
  }
  public hash = (msg: Buffer): Promise<Buffer> => {
    return Promise.resolve(this._hasher(msg));
  };
}
