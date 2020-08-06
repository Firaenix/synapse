declare module 'bittorrent-dht' {
  import { EventEmitter } from 'events';

  export class DHT extends EventEmitter {
    listening: boolean;
    destroyed: boolean;
    nodeId: any;
    nodes: any;
    constructor(opts?: any);
    removeBucketCheckInterval(): void;
    updateBucketTimestamp(): void;
    addNode(node: any): void;
    removeNode(id: any): void;
    toJSON(): any;
    put(opts: any, cb: any): any;
    get(key: any, opts: any, cb: any): void;
    announce(infoHash: any, port: any, cb: any): any;
    lookup(infoHash: any, cb: any): () => void;
    address(): any;
    listen(...args: any[]): void;
    destroy(cb: any): void;
  }

  export default DHT;
}
