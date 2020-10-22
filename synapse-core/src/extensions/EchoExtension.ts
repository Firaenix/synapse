import Wire, { EventExtension } from '@firaenix/bittorrent-protocol';
import bencode from 'bencode';

import { ILogger } from '../services/interfaces/ILogger';

export class EchoExtension extends EventExtension<any> {
  constructor(wire: Wire, private readonly logger: ILogger) {
    super(wire);
  }

  name = 'echo';
  requirePeer?: boolean | undefined = false;
  onHandshake = (infoHash: string, peerId: string, extensions: import('@firaenix/bittorrent-protocol').HandshakeExtensions) => {};
  onExtendedHandshake = (handshake: import('@firaenix/bittorrent-protocol').ExtendedHandshake) => {};

  onRequest = async (index: number, offset: number, length: number): Promise<void> =>
    new Promise((res, rej) => {
      this.sendExtendedMessage(['echo', index, offset, length]);

      this.once(`acked-${index}`, () => {
        this.logger.info('Got ack back');
        res();
      });
    });

  onMessage = (buf: Buffer) => {
    const [flag, ...msg]: [string, ...unknown[]] = bencode.decode(buf);

    try {
      switch (flag) {
        case 'echo':
          this.logger.info('Got echo', msg);
          return this.emit(`acked-${msg[0]}`, msg);
      }
    } catch (error) {
      this.emit('error', error);
    }
  };
}
