import { Metainfo } from './Metainfo';
export interface MetainfoFile {
  info: Metainfo;
  infohash: Buffer;
}

export interface SignedMetainfoFile extends MetainfoFile {
  infosig: Buffer;
  ['infosig algo']: 'ecdsa';
}
