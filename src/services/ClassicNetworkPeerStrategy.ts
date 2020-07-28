import { IPeerStrategy } from './interfaces/IPeerStrategy';
import { Peer } from './Peer';
import hyperswarm from 'hyperswarm';
import Wire from '@firaenix/bittorrent-protocol';

export class ClassicNetworkPeerStrategy implements IPeerStrategy {
  private readonly swarm: any;

  constructor() {
    this.swarm = hyperswarm();
  }

  public startDiscovery = (infoHash: Buffer, onPeerFoundCallback: (connectedWire: Wire) => void) => {
    this.swarm.join(infoHash, {
      lookup: true, // find & connect to peers
      announce: true // optional- announce self as a connection target
    });

    this.swarm.on('connection', (socket, details) => {
      console.log('Connection details', details);
      const wire = new Wire('seed');
      // you can now use the socket as a stream, eg:
      // process.stdin.pipe(socket).pipe(process.stdout)
      wire.pipe(socket).pipe(wire);
      onPeerFoundCallback(wire);
    });
  };
}
