import { SupportedHashAlgorithms } from './SupportedHashAlgorithms';
export interface Metainfo {
  name: Buffer;
  'piece length': number;
  pieces: Buffer[];

  'piece hash algo': SupportedHashAlgorithms;

  files: File[];
}

export interface File {
  length: number;
  path: Buffer;
}
