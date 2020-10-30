import { SupportedHashAlgorithms } from '../../models/SupportedHashAlgorithms';

export interface IHashAlgorithm {
  algorithm: SupportedHashAlgorithms | string;
  hash: (msg: Buffer) => Promise<Buffer>;
}
