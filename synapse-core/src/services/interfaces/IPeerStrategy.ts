import Wire from '@firaenix/bittorrent-protocol';
import { TypedEmitter } from 'tiny-typed-emitter';

export interface PeerStrategyEvents {
  found: (wire: Wire, infoIdHash: Buffer) => void;
  got_update: (key: Buffer) => void;
}

export interface IPeerStrategy extends TypedEmitter<PeerStrategyEvents> {
  name: string;
  startDiscovery: (infoIdentifier: Buffer) => void;

  stopDiscovery: (infoIdentifier: Buffer) => void;
}
