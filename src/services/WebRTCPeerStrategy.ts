import { IPeerStrategy } from './interfaces/IPeerStrategy';
import hyperswarm from 'hyperswarm-web';
import Wire from '@firaenix/bittorrent-protocol';
import { Duplex } from 'stream';
import { isServer } from '../utils/isServer';

export class WebRTCPeerStrategy implements IPeerStrategy {
  private readonly swarm: any;

  constructor() {
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

  public startDiscovery = (infoHash: Buffer, onPeerFoundCallback: (strategyName: string, connectedWire: Wire) => void) => {
    this.swarm.join(infoHash, {
      lookup: true, // find & connect to peers
      announce: true // optional- announce self as a connection target
    });

    this.swarm.on('connection', (socket: Duplex, details: unknown) => {
      const wire = new Wire('seed');
      // you can now use the socket as a stream, eg:
      // process.stdin.pipe(socket).pipe(process.stdout)
      wire.pipe(socket).pipe(wire);
      onPeerFoundCallback('WebRTCPeerStrategy', wire);
    });
  };
}
