import { Metainfo } from './Metainfo';
export interface MerkelMetainfo extends Metainfo {
  'root hash': string;
  'root hash algo': string;
}