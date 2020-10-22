declare module 'bittorrent-dht' {
  import { EventEmitter } from 'events';

  export interface DHTOptions {
    nodeId?: string;
    bootstrap?: string[];
    host?: boolean;
    concurrency?: number;
    hash?: (buf: Buffer) => Buffer;
    verify?: (sig: Buffer, msg: Buffer, pubkey: Buffer) => boolean;
    krpc?: any;
    timeBucketOutdated?: number;
    maxAge?: number;
  }

  export interface DHTPutOptions {
    k: Buffer;
    v: Buffer;
    sign?: (buf: Buffer) => Buffer;
    seq?: number;
    cas?: number;
    salt?: Buffer;
  }

  export interface DHTGetOptions {
    verify?: (sig: Buffer, msg: Buffer, pubkey: Buffer) => boolean;
    salt?: Buffer;
    cache?: boolean;
  }

  export interface DHTGetCallbackRes {
    v: Buffer;
    id: string;
    k?: Buffer;
    sig?: Buffer;
    seq?: number;
  }

  export class DHT extends EventEmitter {
    listening: boolean;
    destroyed: boolean;
    nodeId: string;
    nodes: Array<unknown>;
    constructor(opts?: DHTOptions);
    removeBucketCheckInterval(): void;
    updateBucketTimestamp(): void;
    addNode(node: unknown): void;
    removeNode(id: unknown): void;
    toJSON(): unknown;
    put(opts: DHTPutOptions, cb: (err: Error, hash: Buffer) => void): unknown;
    get(key: Buffer, opts: DHTGetOptions | undefined, cb: (err: Error, res: DHTGetCallbackRes) => void): void;
    announce(infoHash: Buffer, port: number, cb: Function): unknown;
    lookup(infoHash: Buffer, cb: Function): () => void;
    address(): unknown;
    listen(...args: unknown[]): void;
    destroy(cb: unknown): void;
  }

  export default DHT;
}
