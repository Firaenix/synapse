import { EventEmitter } from 'events';

export const PeerStrategyEvents = {
  found: Symbol('found'),
  got_update: Symbol('on:update')
};

export interface IPeerStrategy extends EventEmitter {
  name: string;
  startDiscovery: (infoIdentifier: Buffer) => void;

  stopDiscovery: (infoIdentifier: Buffer) => void;
}
