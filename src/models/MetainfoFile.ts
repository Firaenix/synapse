import { SupportedSignatureAlgorithms } from '../services/interfaces/ISigningAlgorithm';
import { Metainfo } from './Metainfo';

export interface MetainfoFile {
  info: Metainfo;
  infohash: Buffer;
}

export interface SignedMetainfoFile extends MetainfoFile {
  infosig: Buffer;
  ['pub key']: Buffer;
  ['infosig algo']: SupportedSignatureAlgorithms;
}

export function isSignedMetainfo(x: MetainfoFile | SignedMetainfoFile): x is SignedMetainfoFile {
  return !!x['infosig'];
}
