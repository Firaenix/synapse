import Wire, { ExtendedHandshake, Extension, HandshakeExtensions } from '@firaenix/bittorrent-protocol';
import bencode from 'bencode';
import { EventEmitter } from 'events';

import { MetainfoFile } from '../models/MetainfoFile';

enum MetainfoFlags {
  have_metadata = 0x0,
  fetch = 0x1,
  sent_metainfo = 0x99
}

export const MetadataExtensionEvents = {
  ReceivedMetainfo: 'on:metainfo'
};

export class MetadataExtension extends Extension {
  public name = 'metadata';
  public requirePeer?: boolean | undefined;
  public eventBus = new EventEmitter();

  constructor(public readonly wire: Wire, private metadata?: Buffer) {
    super(wire);
  }

  public addMetadata = (metainfo: MetainfoFile) => {
    this.metadata = bencode.encode(metainfo);
    this.sendExtendedMessage([MetainfoFlags.have_metadata, this.metadata !== undefined]);
  };

  onHandshake = (infoHash: string, peerId: string, extensions: HandshakeExtensions) => {
    console.log(this.wire.wireName, 'metadata onHandshake', infoHash, peerId, extensions);
  };

  onExtendedHandshake = (handshake: ExtendedHandshake) => {
    console.log('metadata onExtendedHandshake', handshake);

    console.log(handshake);
    if (handshake.exts[this.name] === undefined) {
      console.warn('Remote peer has no metadata extension');
      return;
    }

    this.sendExtendedMessage([MetainfoFlags.have_metadata, this.metadata !== undefined]);

    // Broadcast whether we have metadata or not
    if (!this.metadata) {
      console.log('Requesting metadata from peer');
      this.sendExtendedMessage([MetainfoFlags.fetch]);
    }
  };
  onMessage = (buf: Buffer) => {
    const [flag, ...msg] = bencode.decode(buf) as [number, any];

    switch (flag) {
      case MetainfoFlags.have_metadata:
        return this.peerHasMetainfo(Boolean(msg[0]));
      case MetainfoFlags.fetch:
        return this.onFetchRequested();
      case MetainfoFlags.sent_metainfo:
        return this.onRecievedMetainfo(Buffer.from(msg[0]));
    }

    console.log('metadata onMessage', buf);
  };

  peerHasMetainfo = (hasMetaInfo: boolean) => {
    // If we have metainfo, dont do anything.
    if (this.metadata) {
      return;
    }

    // if they dont have metainfo, do nothing
    if (!hasMetaInfo) {
      return;
    }

    // If we dont have metainfo, but they do, request it.
    console.log('Requesting metadata from peer');
    this.sendExtendedMessage([MetainfoFlags.fetch]);
  };

  onFetchRequested = () => {
    console.log('metainfo requested from peer');
    this.sendExtendedMessage([MetainfoFlags.sent_metainfo, this.metadata]);
  };

  onRecievedMetainfo = (metainfoBuffer: Buffer) => {
    console.log('GOT METAINFO!');
    const metainfo = bencode.decode(metainfoBuffer);

    console.log('Recieved metainfo:', metainfo.infohash, metainfo.info['piece length']);
    this.eventBus.emit(MetadataExtensionEvents.ReceivedMetainfo, metainfoBuffer);
  };
}
