import Wire from '@firaenix/bittorrent-protocol';

export interface IPeerStrategy {
  startDiscovery: (infoHash: Buffer, onPeerFoundCallback: (connectedWire: Wire) => void) => void;
}
