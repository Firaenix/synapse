import Wire, { IExtension } from '@firaenix/bittorrent-protocol';
import { inject, injectAll, Lifecycle, scoped } from 'tsyringe';

import { MetadataExtension, MetadataExtensionEvents } from '../extensions/Metadata';
import { MetainfoFile, SignedMetainfoFile } from '../models/MetainfoFile';
import { SupportedHashAlgorithms } from '../models/SupportedHashAlgorithms';
import { IHashService } from './HashService';
import { ILogger } from './interfaces/ILogger';
import { IPeerStrategy, PeerStrategyEvents } from './interfaces/IPeerStrategy';
import { ISigningService } from './interfaces/ISigningService';
import { ITorrentDiscovery } from './interfaces/ITorrentDiscovery';
import { MetaInfoService } from './MetaInfoService';
import { Peer } from './Peer';

@scoped(Lifecycle.ResolutionScoped)
export class TorrentDiscovery implements ITorrentDiscovery {
  constructor(
    @injectAll('IPeerStrategy') private readonly peerStrategies: Array<IPeerStrategy>,
    @inject('IHashService') private readonly hashService: IHashService,
    private readonly metainfoService: MetaInfoService,
    @inject('ISigningService') private readonly signingService: ISigningService,
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
          const metadataExtension = new MetadataExtension(connectedWire, infoHash, this.metainfoService, this.hashService, this.signingService, this.logger);
          connectedWire.use(() => metadataExtension);
          const peerId = this.hashService.hash(Buffer.from('DISOVERYPEER'), SupportedHashAlgorithms.sha1);
          console.log('DISCOVERY PEERID', peerId);

          peerList.push(new Peer(connectedWire, infoIdentifier, peerId, this.logger));

          metadataExtension.eventBus.once(MetadataExtensionEvents.ReceivedMetainfo, (metainfo: MetainfoFile) => {
            if (this.metainfoService.metainfo === undefined) {
              throw new Error('Meta info store was not updated on discover');
            }

            if (metainfo.infohash.equals(this.metainfoService.metainfo?.infohash) === false) {
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
          const metadataExtension = new MetadataExtension(connectedWire, infoSig, this.metainfoService, this.hashService, this.signingService, this.logger);
          connectedWire.use(() => metadataExtension as IExtension);
          const peerId = this.hashService.hash(Buffer.from('DISOVERYPEER'), SupportedHashAlgorithms.sha1);
          console.log('DISCOVERY PEERID', peerId);

          peerList.push(new Peer(connectedWire, infoIdentifier, peerId, this.logger));

          metadataExtension.eventBus.once(MetadataExtensionEvents.ReceivedMetainfo, (metainfo: SignedMetainfoFile) => {
            if (this.metainfoService.metainfo === undefined) {
              throw new Error('Meta info store was not updated on discover');
            }

            if (metainfo.infohash.equals(this.metainfoService.metainfo?.infohash) === false) {
              throw new Error('What how do');
            }
            resolve(metainfo);
          });
        });
      }
    });
}
