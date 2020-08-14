import { MetainfoFile, SignedMetainfoFile, isSignedMetainfo } from '../models/MetainfoFile';
import { injectable, scoped, Lifecycle } from 'tsyringe';
import { SupportedSignatureAlgorithms } from './interfaces/ISigningAlgorithm';
import { SupportedHashAlgorithms } from '../models/SupportedHashAlgorithms';

export interface MetaInfoServiceArgs {
  infoHash?: {
    hash: Buffer;
    algo: SupportedHashAlgorithms;
  };
  infoSig?: {
    sig: Buffer;
    algo: SupportedSignatureAlgorithms;
  };
  pieceCount?: number;
  pieceHashAlgo?: SupportedHashAlgorithms;
  filechunks?: Array<Buffer>;
}

/**
 * Just a wrapper container for storing request level configuration.
 * eg. MetaInfo, InfoHash
 */
@injectable()
@scoped(Lifecycle.ResolutionScoped)
export class MetaInfoService {
  public readonly infohash?: Buffer;
  public readonly infoHashAlgo?: SupportedHashAlgorithms;
  public readonly pieceCount?: number;
  public readonly pieceHashAlgo?: SupportedHashAlgorithms;

  public readonly infosig?: Buffer;
  public readonly infosigAlgo?: SupportedSignatureAlgorithms;

  public readonly fileChunks: Array<Buffer>;

  constructor(args: MetaInfoServiceArgs) {
    this.infohash = args.infoHash?.hash;
    this.infoHashAlgo = args.infoHash?.algo;

    this.infosig = args.infoSig?.sig;
    this.infosigAlgo = args.infoSig?.algo;

    this.pieceCount = args.pieceCount;
    this.pieceHashAlgo = args.pieceHashAlgo;

    this.fileChunks = args.filechunks || [];
  }
}
