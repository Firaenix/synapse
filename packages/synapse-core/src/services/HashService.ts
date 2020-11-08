import crypto from 'crypto';
import { inject, injectAll, singleton } from 'tsyringe';

import { SupportedHashAlgorithms } from '../models/SupportedHashAlgorithms';
import { ILogger } from '../services/interfaces/ILogger';
import { IHashAlgorithm } from './interfaces/IHashAlgorithm';

export interface IHashService {
  hash: (buf: Buffer, algorithm: SupportedHashAlgorithms) => Promise<Buffer>;
}

export const CryptoHash = (algo: string) => (buf: Buffer) => {
  const hash = crypto.createHash(algo);
  return hash.update(buf).digest();
};

@singleton()
export class HashService implements IHashService {
  private readonly strategies: { [x: string]: IHashAlgorithm } = {};

  constructor(@injectAll('IHashAlgorithm') hashAlgos: IHashAlgorithm[], @inject('ILogger') private readonly logger: ILogger) {
    logger.info(
      'CREATING HASHSERVICE',
      hashAlgos.map((x) => x.algorithm)
    );

    for (const algo of hashAlgos) {
      this.strategies[algo.algorithm] = algo;
    }
  }

  public hash = async (buf: Buffer, algorithm: SupportedHashAlgorithms) => {
    return await this.strategies[algorithm].hash(buf);
  };
}
