import Wire from '@firaenix/bittorrent-protocol';
import { EventEmitter } from 'events';
import hyperswarm from 'hyperswarm';
import { v4 as uuid } from 'uuid';

import { IPeerStrategy, PeerStrategyEvents } from '../interfaces/IPeerStrategy';

export class ClassicNetworkPeerStrategy extends EventEmitter implements IPeerStrategy {
  private readonly swarm: hyperswarm;
  public name = 'ClassicNetworkPeerStrategy';

  constructor() {
    super();
    this.swarm = hyperswarm();
  }
  public stopDiscovery = (infoHash: Buffer) => {
    this.swarm.leave(infoHash);
  };

  public startDiscovery = (infoHash: Buffer) => {
    this.swarm.join(infoHash, {
      lookup: true, // find & connect to peers
      announce: true // optional- announce self as a connection target
    });

    this.swarm.on('updated', ({ key }) => {
      this.emit(PeerStrategyEvents.got_update, key);
    });

    this.swarm.on('connection', (socket, details) => {
      const wire = new Wire(uuid());
      wire.pipe(socket).pipe(wire);
      this.emit(PeerStrategyEvents.found, wire, infoHash);
    });
  };
}
