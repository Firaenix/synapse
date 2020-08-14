import Wire from '@firaenix/bittorrent-protocol';
import { EventEmitter } from 'events';

export const PeerStrategyEvents = {
  found: Symbol('found')
};

export interface IPeerStrategy extends EventEmitter {
  startDiscovery: (infoIdentifier: Buffer) => void;
}
