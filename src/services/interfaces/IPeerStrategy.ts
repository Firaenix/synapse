import Wire from '@firaenix/bittorrent-protocol';

export interface IPeerStrategy {
  startDiscovery: (infoHash: Buffer, onPeerFoundCallback: (strategyName: string, connectedWire: Wire) => void) => void;
}
