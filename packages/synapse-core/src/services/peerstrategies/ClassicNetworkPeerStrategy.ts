import Wire from '@firaenix/bittorrent-protocol';
import hyperswarm from 'hyperswarm';
import { TypedEmitter } from 'tiny-typed-emitter';
import { inject, singleton } from 'tsyringe';
import { v4 as uuid } from 'uuid';

import { ILogger } from '../interfaces/ILogger';
import { IPeerStrategy, PeerStrategyEvents } from '../interfaces/IPeerStrategy';

@singleton()
export class ClassicNetworkPeerStrategy extends TypedEmitter<PeerStrategyEvents> implements IPeerStrategy {
  private readonly swarm: hyperswarm;
  public name = 'ClassicNetworkPeerStrategy';

  private id = uuid();

  constructor(@inject('ILogger') private readonly logger: ILogger) {
    super();
    logger.info('Creating ClassicNetworkPeerStrategy', this.id);
    this.swarm = hyperswarm();
  }
  public stopDiscovery = async (infoIdentifier: Buffer) => {
    this.logger.info('Leaving channel', infoIdentifier, this.id);
    this.swarm.leave(infoIdentifier);
  };

  public startDiscovery = (infoIdentifier: Buffer) => {
    this.swarm.join(infoIdentifier, {
      lookup: true, // find & connect to peers
      announce: true // optional- announce self as a connection target
    });

    this.swarm.on('updated', ({ key }) => {
      this.emit('got_update', key);
    });

    this.swarm.on('connection', (socket, details) => {
      const id = details?.peer?.host ? `TCP-${details.peer.host}:${details.peer.port}` : `UDP-${Math.random().toString(36).substr(2, 9)}`;
      const wire = new Wire(id);
      wire.pipe(socket).pipe(wire);
      this.emit('found', wire, infoIdentifier);
    });
  };
}
