import { SupportedHashAlgorithms } from './SupportedHashAlgorithms';
export interface Metainfo {
  name: Uint8Array;
  'piece length': number;
  pieces: Uint8Array;

  'piece hash algo': SupportedHashAlgorithms;

  files: File[];
}

export interface File {
  length: number;
  path: Uint8Array;
}
