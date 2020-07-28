import { SupportedHashAlgorithms } from '../models/SupportedHashAlgorithms';
import * as blake3 from 'blake3';
import crypto from 'crypto';
import { singleton } from 'tsyringe';

export interface IHashService {
  hash: (buf: Buffer, algorithm: SupportedHashAlgorithms) => Buffer;
}
type Strats = { [algo: string]: (buf: Buffer) => Buffer };

const Blake3Hash = (buf: Buffer): Buffer => {
  return blake3.createHash().update(buf).digest();
};

const CryptoHash = (algo: string) => (buf: Buffer): Buffer => {
  const hash = crypto.createHash(algo);
  return hash.update(buf).digest();
};

@singleton()
export class HashService implements IHashService {
  private strategies: Strats = {
    [SupportedHashAlgorithms.blake3]: Blake3Hash,
    [SupportedHashAlgorithms.sha1]: CryptoHash('sha1'),
    [SupportedHashAlgorithms.sha256]: CryptoHash('sha256')
  };

  public hash = (buf: Buffer, algorithm: SupportedHashAlgorithms) => {
    return this.strategies[algorithm](buf);
  };
}
