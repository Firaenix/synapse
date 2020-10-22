import { injectable, Lifecycle, scoped } from 'tsyringe';

import { isSignedMetainfo, MetainfoFile, SignedMetainfoFile } from '../models/MetainfoFile';
import { SupportedSignatureAlgorithms } from './interfaces/ISigningAlgorithm';

/**
 * Just a wrapper container for storing request level configuration.
 * eg. MetaInfo, InfoHash
 */
@injectable()
@scoped(Lifecycle.ResolutionScoped)
export class MetaInfoService {
  private _metainfo?: MetainfoFile;
  public updatedSequence = 0;

  constructor(metainfo: MetainfoFile | SignedMetainfoFile | undefined, public fileChunks: Array<Buffer>) {
    this.metainfo = metainfo;
  }

  public set metainfo(metainfo: MetainfoFile | SignedMetainfoFile | undefined) {
    this._metainfo = metainfo;
  }

  public get metainfo() {
    return this._metainfo;
  }

  public get infoIdentifier(): Buffer | undefined {
    return this.infoSig?.sig || this.infoHash;
  }

  public get infoHash(): Buffer | undefined {
    return this._metainfo?.infohash;
  }

  public get infoSig(): { sig: Buffer; algo: SupportedSignatureAlgorithms } | undefined {
    if (!this._metainfo) {
      return undefined;
    }

    if (!isSignedMetainfo(this._metainfo)) {
      return undefined;
    }

    return {
      sig: this._metainfo.infosig,
      algo: this._metainfo['infosig algo']
    };
  }

  public get pieceCount(): number | undefined {
    return this._metainfo?.info.pieces.length;
  }
}
