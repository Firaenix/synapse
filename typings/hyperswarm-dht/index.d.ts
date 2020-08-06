declare module '@hyperswarm/dht' {
  import stream from 'stream';
  import { EventEmitter } from 'events';

  export class HyperDHT extends EventEmitter {
    mutable: MutableStore;
    immutable: ImmutableStore;
    constructor(opts: HyperDHTOptions);
    lookup(topic: Buffer, opts?: LookupOptions, cb: (data: any) => void): stream;
    announce(topic: Buffer, opts: AnnounceOptions, cb: (data: any) => void): stream;
    unannounce(topic: Buffer, opts: AnnounceOptions, cb: (data: any) => void): void;
    destroy(): void;
    listen(port?: number): void;
  }

  export interface LookupOptions {
    port?: number;
    localAddress?: {
      host: string;
      port: number;
    };
  }

  export type AnnounceOptions = LookupOptions;

  export default (opts?: HyperDHTOptions) => HyperDHT(opts);
  export interface HyperDHTOptions {
    bootstrap?: string[];
    ephemeral?: boolean;
    adaptive?: boolean;
    maxAge?: number;
  }

  export class ImmutableStore {
    get(key: Buffer, cb: (err: Error, value: Buffer, info: { id: string }) => void): stream;
    put(value: Buffer, cb: (err: Error, key: Buffer) => void): stream;
  }
  export class MutableStore {
    keypair(): KeyPair;

    salt(str?: string, size?: number): Buffer;

    sign(value: Buffer, opts: SignOptions): any;

    signable(value: Buffer, options): any;

    get(key: Buffer, opts?: MutableGetOptions, cb?: MutableGetCallback): stream;

    put(value: Buffer, opts: MutablePutOptions, cb: MutablePutCallback): stream;
  }

  export interface MutablePutOptions {
    keypair: KeyPair;
    signature?: Buffer;
    seq?: number;
    salt?: Buffer;
  }
  export type MutablePutCallback = (err: Error, data: { key: Buffer; info: { signature: Buffer; seq: number; salt?: Buffer } }) => void;

  export type SignOptions = Pick<MutablePutOptions, 'salt' | 'keypair'>;
  export type SignableOptions = Pick<MutablePutOptions, 'salt' | 'seq'>;

  export interface KeyPair {
    publicKey: string | Buffer;
    secretKey: string | Buffer;
  }

  export interface MutableGetOptions {
    seq?: number;
    salt?: Buffer;
  }
  export type MutableGetCallback = (err: Error, data: { id: Buffer; value: Buffer; signature: Buffer; seq: number; salt?: Buffer }) => void;
}
