import { MetainfoFile } from '../models/MetainfoFile';
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

  constructor(public readonly metainfo: MetainfoFile, public readonly fileChunks: Array<Buffer>) {
    this.infohash = metainfo.infohash;
    this.pieceCount = metainfo.info.pieces.length;
  }
}
