import { MetainfoFile, SignedMetainfoFile, isSignedMetainfo } from '../models/MetainfoFile';
import { injectable, scoped, Lifecycle } from 'tsyringe';
/**
 * Just a wrapper container for storing request level configuration.
 * eg. MetaInfo, InfoHash
 */
@injectable()
@scoped(Lifecycle.ResolutionScoped)
export class MetaInfoService {
  public readonly infohash: Buffer;
  public readonly pieceCount: number;
  public readonly infosig?: Buffer;
  public readonly infosigAlgo?: 'ecdsa';

  constructor(public readonly metainfo: MetainfoFile | SignedMetainfoFile, public readonly fileChunks: Array<Buffer>) {
    this.infohash = metainfo.infohash;
    this.pieceCount = metainfo.info.pieces.length;

    if (isSignedMetainfo(metainfo)) {
      this.infosig = metainfo.infosig;
      this.infosigAlgo = metainfo['infosig algo'];
    }
  }
}
