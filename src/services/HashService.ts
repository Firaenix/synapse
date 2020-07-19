import { SupportedHashAlgorithms } from '../models/SupportedHashAlgorithms';
import * as blake3 from 'blake3';
import crypto from 'crypto';

interface IHashService {
  hash: (buf: Uint8Array, algorithm: SupportedHashAlgorithms) => Uint8Array;
}
type Strats = { [algo: string]: (buf: Uint8Array) => Uint8Array };

const Blake3Hash = (buf: Uint8Array): Uint8Array => {
  return blake3.createHash().update(buf).digest();
};

const CryptoHash = (algo: string) => (buf: Uint8Array): Uint8Array => {
  const hash = crypto.createHash(algo);
  return hash.update(buf).digest();
};

export class HashService implements IHashService {
  private strategies: Strats = {
    [SupportedHashAlgorithms.blake3]: Blake3Hash,
    [SupportedHashAlgorithms.sha1]: CryptoHash('sha1'),
    [SupportedHashAlgorithms.sha256]: CryptoHash('sha256')
  };

  public hash = (buf: Uint8Array, algorithm: SupportedHashAlgorithms) => {
    return this.strategies[algorithm](buf);
  };
}
