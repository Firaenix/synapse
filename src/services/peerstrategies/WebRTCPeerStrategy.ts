import Wire from '@firaenix/bittorrent-protocol';
import { EventEmitter } from 'events';
import hyperswarm from 'hyperswarm-web';
import { Duplex } from 'stream';

import { isServer } from '../../utils/isServer';
import { IPeerStrategy, PeerStrategyEvents } from '../interfaces/IPeerStrategy';

export class WebRTCPeerStrategy extends EventEmitter implements IPeerStrategy {
  private readonly swarm: any;
  public name = 'WebRTCPeerStrategy';

  constructor() {
    super();
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
  }

  public startDiscovery = (infoIdentifier: Buffer) => {
    this.swarm.join(infoIdentifier, {
      lookup: true, // find & connect to peers
      announce: true // optional- announce self as a connection target
    });

    this.swarm.on('updated', ({ key }) => {
      this.emit(PeerStrategyEvents.got_update, key);
    });

    this.swarm.on('connection', (socket: Duplex, details: unknown) => {
      const wire = new Wire('seed');
      // you can now use the socket as a stream, eg:
      // process.stdin.pipe(socket).pipe(process.stdout)
      wire.pipe(socket).pipe(wire);
      this.emit(PeerStrategyEvents.found, wire, infoIdentifier);
    });
  };

  public stopDiscovery = (infoHash: Buffer) => {
    this.swarm.leave(infoHash);
  };
}