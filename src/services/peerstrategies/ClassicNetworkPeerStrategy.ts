import { IPeerStrategy } from '../interfaces/IPeerStrategy';
import hyperswarm from 'hyperswarm';
import Wire from '@firaenix/bittorrent-protocol';

export class ClassicNetworkPeerStrategy implements IPeerStrategy {
  private readonly swarm: hyperswarm;

  constructor() {
    this.swarm = hyperswarm();
  }

  public startDiscovery = (infoHash: Buffer, onPeerFoundCallback: (strategyName: string, connectedWire: Wire) => void) => {
    this.swarm.join(infoHash, {
      lookup: true, // find & connect to peers
      announce: true // optional- announce self as a connection target
    });

    this.swarm.on('updated', ({ key }) => {
      console.log('NEW SHIT AVAILABLE', key);
    });

    this.swarm.on('connection', (socket, details) => {
      const wire = new Wire('seed');
      wire.pipe(socket).pipe(wire);
      onPeerFoundCallback('ClassicNetworkPeerStrategy', wire);
    });
  };
}
