import Wire, { EventExtension, ExtendedHandshake, HandshakeExtensions } from '@firaenix/bittorrent-protocol';

import { MetainfoFile } from '../../models/MetainfoFile';
import { DHTService } from '../../services/DHTService';

export class UpdateManager {
  private readonly peerUpdateExts: Array<UpdateExtension> = [];

  public addPeerExt = (ext: UpdateExtension) => {
    ext.on('disconnect', this.onPeerDisconnected);
    ext.on('update', this.onUpdateReceived);

    if (this.peerUpdateExts.find((x) => x.id === ext.id) !== undefined) {
      return;
    }

    this.peerUpdateExts.push(ext);
    console.log('PeerExts Count', this.peerUpdateExts.length);
  };

  public broadcastUpdate = (newInfoId: Buffer, pubKey: Buffer, signature: Buffer) => {
    console.log('Broadcasting Update', newInfoId.toString('hex'), pubKey.toString('hex'), signature.toString('hex'));

    for (const ext of this.peerUpdateExts) {
      ext.sendUpdate(newInfoId, pubKey, signature);
    }
  };

  private onUpdateReceived = () => {};

  private onPeerDisconnected = () => {};
}

interface UpdateExtensionEvents {
  created: (ext: UpdateExtension) => void;
  disconnect: (ext: UpdateExtension) => void;
  update: (ext: UpdateExtension, newInfoID: Buffer) => void;
}

const UpdateExtensionMessages = {
  SendUpdate: 0x99
};

export class UpdateExtension extends EventExtension<UpdateExtensionEvents> {
  public name = 'update';
  public requirePeer = false;
  public id = Math.random().toString(36).substr(2, 9);

  constructor(wire: Wire, infoId: Buffer, metainfo: MetainfoFile | undefined, private readonly dhtService: DHTService) {
    super(wire);
  }

  public onHandshake = (infoHash: string, peerId: string, extensions: HandshakeExtensions) => {
    this.emit('created', this);
  };
  public onExtendedHandshake = (handshake: ExtendedHandshake) => {};
  public onMessage = (buf: Buffer) => {};

  public sendUpdate = (newInfoId: Buffer, pubKey: Buffer, signature: Buffer) => {
    this.sendExtendedMessage([UpdateExtensionMessages.SendUpdate, newInfoId, pubKey, signature]);
  };
}
