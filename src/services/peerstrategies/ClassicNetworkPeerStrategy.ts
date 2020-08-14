import { IPeerStrategy, PeerStrategyEvents } from '../interfaces/IPeerStrategy';
import hyperswarm from 'hyperswarm';
import Wire from '@firaenix/bittorrent-protocol';
import { EventEmitter } from 'events';

export class ClassicNetworkPeerStrategy extends EventEmitter implements IPeerStrategy {
  private readonly swarm: hyperswarm;

  constructor() {
    super();
    this.swarm = hyperswarm();
  }

  public startDiscovery = (infoHash: Buffer) => {
    this.swarm.join(infoHash, {
      lookup: true, // find & connect to peers
      announce: true // optional- announce self as a connection target
    });

    this.swarm.on('updated', ({ key }) => {
      console.log('NEW SHIT AVAILABLE', key);
    });

    this.swarm.on('connection', (socket, details) => {
      const wire = new Wire();
      wire.pipe(socket).pipe(wire);
      this.emit(PeerStrategyEvents.found, 'ClassicNetworkPeerStrategy', wire, infoHash);
    });
  };
}
