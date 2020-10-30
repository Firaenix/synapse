import Wire from '@firaenix/bittorrent-protocol';
import { ILogger } from '@firaenix/synapse-core/lib/services/interfaces/ILogger';
import { IPeerStrategy, PeerStrategyEvents } from '@firaenix/synapse-core/lib/services/interfaces/IPeerStrategy';
import { isServer } from '@firaenix/synapse-core/lib/utils/isServer';
import hyperswarm from 'hyperswarm-web';
import { Duplex } from 'stream';
import { TypedEmitter } from 'tiny-typed-emitter';
import { inject, singleton } from 'tsyringe';
import { v4 as uuid } from 'uuid';

@singleton()
export class WebRTCPeerStrategy extends TypedEmitter<PeerStrategyEvents> implements IPeerStrategy {
  private readonly swarm: any;
  public name = 'WebRTCPeerStrategy';
  private id = uuid();

  constructor(@inject('ILogger') private readonly logger: ILogger) {
    super();
    logger.info('Creating WebRTCPeerStrategy', this.id);
    this.swarm = hyperswarm({
      // If you omit this, it'll try to connect to 'wss://hyperswarm.mauve.moe'
      // It will also attempt to connect to a local proxy on `ws://localhost:4977`
      wsProxy: 'ws://localhost:4977',
      // The configuration passed to the SimplePeer constructor
      //See https://github.com/feross/simple-peer#peer--new-peeropts
      // for more options
      webrtcBootstrap: ['http://localhost:4000'],
      simplePeer: {
        // The configuration passed to the RTCPeerConnection constructor,for more details see
        // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/RTCPeerConnection#RTCConfiguration_dictionary
        wrtc: isServer() ? require('wrtc') : undefined
      }
    });

    // this.swarm.listen();
  }

  public startDiscovery = (infoIdentifier: Buffer) => {
    this.swarm.join(infoIdentifier, {
      lookup: true, // find & connect to peers
      announce: true // optional- announce self as a connection target
    });

    this.swarm.on('updated', ({ key }) => {
      this.emit('got_update', key);
    });

    this.swarm.on('connection', (socket: Duplex, details: unknown) => {
      const wire = new Wire('seed');
      // you can now use the socket as a stream, eg:
      // process.stdin.pipe(socket).pipe(process.stdout)
      wire.pipe(socket).pipe(wire);
      this.emit('found', wire, infoIdentifier);
    });
  };

  public stopDiscovery = async (infoIdentifier: Buffer) => {
    this.logger.info('Leaving channel', infoIdentifier, this.id);
    this.swarm.leave(infoIdentifier);
  };
}
