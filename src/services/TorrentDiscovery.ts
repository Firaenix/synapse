import Wire, { IExtension } from '@firaenix/bittorrent-protocol';
import { inject, injectable, injectAll } from 'tsyringe';

import { MetadataExtension } from '../extensions/Metadata';
import { isSignedMetainfo, MetainfoFile } from '../models/MetainfoFile';
import { SupportedHashAlgorithms } from '../models/SupportedHashAlgorithms';
import { IHashService } from './HashService';
import { ILogger } from './interfaces/ILogger';
import { IPeerStrategy } from './interfaces/IPeerStrategy';
import { ISigningService } from './interfaces/ISigningService';
import { ITorrentDiscovery } from './interfaces/ITorrentDiscovery';
import { MetaInfoService } from './MetaInfoService';
import { Peer } from './Peer';

@injectable()
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
      for (const strat of this.peerStrategies) {
        const infoHashHash = this.hashService.hash(infoHash, SupportedHashAlgorithms.sha256);
        strat.startDiscovery(infoHashHash);

        strat.on('found', async (connectedWire: Wire) => {
          try {
            const metaInfo = await this.discoverByInfoIdentifier(connectedWire, infoHash);

            if (!this.metainfoService.metainfo) {
              return reject(new Error('Metainfo service is empty'));
            }

            if (metaInfo.infohash.equals(this.metainfoService.metainfo.infohash) === false) {
              return reject(new Error('What how do'));
            }

            resolve(metaInfo);
          } catch (error) {
            reject(error);
          } finally {
            for (const strat of this.peerStrategies) {
              strat.stopDiscovery(infoHash);
            }
          }
        });
      }
    });

  public discoverByInfoSig = (infoSig: Buffer): Promise<MetainfoFile> =>
    new Promise<MetainfoFile>((resolve, reject) => {
      for (const strat of this.peerStrategies) {
        const infoSigHash = this.hashService.hash(infoSig, SupportedHashAlgorithms.sha256);
        strat.startDiscovery(infoSigHash);

        strat.on('found', async (connectedWire: Wire) => {
          this.logger.info('TorrentDiscovery', 'Found wire', connectedWire.wireName);
          try {
            const metaInfo = await this.discoverByInfoIdentifier(connectedWire, infoSig);

            if (!this.metainfoService.metainfo) {
              return reject(new Error('Metainfo service is empty'));
            }

            if (!isSignedMetainfo(metaInfo)) {
              return reject(new Error('Not a signed metainfo file'));
            }

            if (!isSignedMetainfo(this.metainfoService.metainfo)) {
              return reject(new Error('metainfo service does not contain a signed metainfo file'));
            }

            if (metaInfo.infosig.equals(this.metainfoService.metainfo.infosig) === false) {
              return reject(new Error('What how do'));
            }

            resolve(metaInfo);
          } catch (error) {
            reject(error);
          } finally {
            // for (const strat of this.peerStrategies) {
            //   strat.stopDiscovery(infoSig);
            // }
          }
        });
      }
    });

  private discoverByInfoIdentifier = (connectedWire: Wire, infoId: Buffer) =>
    new Promise<MetainfoFile>((resolve, reject) => {
      this.logger.info('TorrentDiscovery - attempting to get metainfo from wire', connectedWire.wireName);
      connectedWire.on('error', (err: Error) => {
        this.logger.error(err);

        reject(err);
      });

      const peerId = this.hashService.hash(Buffer.from(`DISCOVERY${connectedWire.wireName}`), SupportedHashAlgorithms.sha1);

      const metadataExtension = new MetadataExtension(connectedWire, infoId, this.metainfoService, this.hashService, this.signingService, this.logger);
      connectedWire.use(() => metadataExtension as IExtension);

      metadataExtension.on('error', (err) => {
        this.logger.error('TorrentDiscovery - failed to get metadata from wire', connectedWire.wireName);
        this.logger.error(err);
        reject(err);
      });

      metadataExtension.once('ReceivedMetainfo', (metainfo: MetainfoFile) => {
        if (this.metainfoService.metainfo === undefined) {
          throw new Error('Meta info store was not updated on discover');
        }

        resolve(metainfo);
      });

      new Peer(connectedWire, infoId, peerId, this.logger);
    });
}
