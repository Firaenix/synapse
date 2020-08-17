import Wire from '@firaenix/bittorrent-protocol';
import bencode from 'bencode';
import { inject, injectAll, Lifecycle, scoped } from 'tsyringe';

import { MetadataExtension, MetadataExtensionEvents } from '../extensions/Metadata';
import { MetainfoFile } from '../models/MetainfoFile';
import { SupportedHashAlgorithms } from '../models/SupportedHashAlgorithms';
import { IHashService } from './HashService';
import { ILogger } from './interfaces/ILogger';
import { IPeerStrategy, PeerStrategyEvents } from './interfaces/IPeerStrategy';
import { ITorrentDiscovery } from './interfaces/ITorrentDiscovery';
import { MetaInfoService } from './MetaInfoService';
import { Peer } from './Peer';

@scoped(Lifecycle.ResolutionScoped)
export class TorrentDiscovery implements ITorrentDiscovery {
  constructor(
    @injectAll('IPeerStrategy') private readonly peerStrategies: Array<IPeerStrategy>,
    @inject('IHashService') private readonly hashService: IHashService,
    private readonly metainfoService: MetaInfoService,
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
          const metadataExtension = new MetadataExtension(connectedWire, this.metainfoService);
          connectedWire.use(() => metadataExtension);
          const peerId = this.hashService.hash(Buffer.from('DISOVERYPEER'), SupportedHashAlgorithms.sha1);
          console.log('DISCOVERY PEERID', peerId);

          peerList.push(new Peer(connectedWire, infoIdentifier, peerId, this.logger));

          metadataExtension.eventBus.once(MetadataExtensionEvents.ReceivedMetainfo, (buf: Buffer) => {
            const metainfo = bencode.decode(buf) as MetainfoFile;

            if (this.metainfoService.metainfo === undefined) {
              throw new Error('Meta info store was not updated on discover');
            }

            if (metainfo.infohash.equals(this.metainfoService.metainfo?.infohash)) {
              throw new Error('What how do');
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
          const metadataExtension = new MetadataExtension(connectedWire, this.metainfoService);
          connectedWire.use(() => metadataExtension);
          const peerId = this.hashService.hash(Buffer.from('DISOVERYPEER'), SupportedHashAlgorithms.sha1);
          console.log('DISCOVERY PEERID', peerId);

          peerList.push(new Peer(connectedWire, infoIdentifier, peerId, this.logger));

          metadataExtension.eventBus.once(MetadataExtensionEvents.ReceivedMetainfo, (buf: Buffer) => {
            const metainfo = bencode.decode(buf) as MetainfoFile;

            if (this.metainfoService.metainfo === undefined) {
              throw new Error('Meta info store was not updated on discover');
            }

            if (metainfo.infohash.equals(this.metainfoService.metainfo?.infohash)) {
              throw new Error('What how do');
            }
            resolve(metainfo);
          });
        });
      }
    });
}
