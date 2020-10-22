import { SupportedHashAlgorithms } from '../../models/SupportedHashAlgorithms';
import { CryptoHash } from '../HashService';
import { IHashAlgorithm } from '../interfaces/IHashAlgorithm';

export class SHA1HashAlgorithm implements IHashAlgorithm {
  private _hasher: (buf: Buffer) => Buffer;

  constructor() {
    this._hasher = CryptoHash('sha1');
  }
  public algorithm = SupportedHashAlgorithms.sha1;

  public hash = (msg: Buffer): Buffer => {
    return this._hasher(msg);
  };
}
