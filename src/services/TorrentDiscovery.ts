import Wire from '@firaenix/bittorrent-protocol';
import bencode from 'bencode';
import { inject, injectAll } from 'tsyringe';

import { MetadataExtension, MetadataExtensionEvents } from '../extensions/Metadata';
import { MetainfoFile } from '../models/MetainfoFile';
import { SupportedHashAlgorithms } from '../models/SupportedHashAlgorithms';
import { IHashService } from './HashService';
import { ILogger } from './interfaces/ILogger';
import { IPeerStrategy, PeerStrategyEvents } from './interfaces/IPeerStrategy';
import { ITorrentDiscovery } from './interfaces/ITorrentDiscovery';
import { Peer } from './Peer';

export class TorrentDiscovery implements ITorrentDiscovery {
  constructor(
    @injectAll('IPeerStrategy') private readonly peerStrategies: Array<IPeerStrategy>,
    @inject('IHashService') private readonly hashService: IHashService,
    @inject('ILogger') private readonly logger: ILogger
  ) {}

  public discoverByInfoHash = (infoHash: Buffer): Promise<MetainfoFile> =>
    new Promise<MetainfoFile>((resolve, reject) => {
      const peerList: Peer[] = [];

      for (const strat of this.peerStrategies) {
        const infoHashHash = this.hashService.hash(infoHash, SupportedHashAlgorithms.sha256);
        strat.startDiscovery(infoHashHash);

        strat.on(PeerStrategyEvents.found, (connectedWire: Wire, infoIdentifier: Buffer) => {
          console.log('DISCOVERED NEW PEER');
          const metadataExtension = new MetadataExtension(connectedWire);
          connectedWire.use(() => metadataExtension);
          const peerId = this.hashService.hash(Buffer.from('DISOVERYPEER'), SupportedHashAlgorithms.sha1);
          console.log('DISCOVERY PEERID', peerId);

          peerList.push(new Peer(connectedWire, infoIdentifier, peerId, this.logger));

          metadataExtension.eventBus.on(MetadataExtensionEvents.ReceivedMetainfo, (buf: Buffer) => {
            const metainfo = bencode.decode(buf) as MetainfoFile;
            for (const peer of peerList) {
              peer.destroy();
            }

            for (const strat of this.peerStrategies) {
              strat.stopDiscovery(infoHash);
              strat.removeAllListeners(PeerStrategyEvents.found);
            }

            resolve(metainfo);
          });
        });
      }
    });

  public discoverByInfoSig = (infoSig: Buffer): Promise<MetainfoFile> =>
    new Promise<MetainfoFile>((resolve, reject) => {
      const peerList: Peer[] = [];

      for (const strat of this.peerStrategies) {
        const infoSigHash = this.hashService.hash(infoSig, SupportedHashAlgorithms.sha256);
        strat.startDiscovery(infoSigHash);

        strat.on(PeerStrategyEvents.found, (connectedWire: Wire, infoIdentifier: Buffer) => {
          console.log('DISCOVERED NEW PEER');
          const metadataExtension = new MetadataExtension(connectedWire);
          connectedWire.use(() => metadataExtension);
          const peerId = this.hashService.hash(Buffer.from('DISOVERYPEER'), SupportedHashAlgorithms.sha1);
          console.log('DISCOVERY PEERID', peerId);

          peerList.push(new Peer(connectedWire, infoIdentifier, peerId, this.logger));

          metadataExtension.eventBus.on(MetadataExtensionEvents.ReceivedMetainfo, (buf: Buffer) => {
            const metainfo = bencode.decode(buf) as MetainfoFile;
            for (const peer of peerList) {
              peer.destroy();
            }

            for (const strat of this.peerStrategies) {
              strat.stopDiscovery(infoSigHash);
              strat.removeAllListeners(PeerStrategyEvents.found);
            }

            resolve(metainfo);
          });
        });
      }
    });
}
