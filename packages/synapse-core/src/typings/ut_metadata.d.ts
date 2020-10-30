declare module 'ut_metadata' {
  import Wire from '@firaenix/bittorrent-protocol';
  import { EventEmitter } from 'events';

  export class UtMetadata extends EventEmitter {
    constructor(wire: Wire);
    onHandshake(infoHash: unknown, peerId: unknown, extensions: unknown): void;
    onExtendedHandshake(handshake: unknown): boolean;
    onMessage(buf: unknown): void;
    /**
     * Ask the peer to send metadata.
     * @public
     */
    fetch(): void;
    /**
     * Stop asking the peer to send metadata.
     * @public
     */
    cancel(): void;
    setMetadata(metadata: Buffer): boolean;
  }

  export default (metadata?: Buffer) => UtMetadata;
}
