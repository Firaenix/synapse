import { Metainfo } from './Metainfo';
export interface MutableMetainfo extends Metainfo {
  'update url': string;
  'update pub key': string;
  'update pub key algo': string;
}