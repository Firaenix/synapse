import { PeerManager } from './PeerManager';
import { MetainfoFile } from '../models/MetainfoFile';
import { IHashService } from './HashService';
import { DiskFile, DownloadedFile } from '../models/DiskFile';
import Bitfield from 'bitfield';
import { chunkBuffer } from '../utils/chunkBuffer';
import { autoInjectable, injectable, inject } from 'tsyringe';
import { PieceManager } from './PieceManager';
import { MetaInfoService } from './MetaInfoService';
import stream from 'stream';

@injectable()
export class TorrentManager {
  public downloadStream: stream.Readable;

  /**
   * if files is undefined, you are a leech, seeders have all the data
   * @param peerDiscovery
   * @param hashService
   * @param metainfoFile
   * @param files
   */
  constructor(
    @inject('IHashService') private readonly hashService: IHashService,
    private readonly peerManager: PeerManager,
    private readonly metainfoService: MetaInfoService,
    private readonly pieceManager: PieceManager
  ) {
    this.downloadStream = new stream.Readable({
      read(size) {
        return true;
      }
    });
  }

  public startTorrent = () => {
    this.peerManager.bootstrapManager(this.onPieceValidated);
  };

  public updateTorrent = () => {};

  private waitForUpdates = () => {};

  private verifyIsFinishedDownloading = () => {
    console.log('Got', this.pieceManager.getPieceCount(), 'pieces /', this.metainfoService.pieceCount);

    // Still need more pieces
    if (this.pieceManager.getPieceCount() < this.metainfoService.pieceCount) {
      return;
    }

    // We are done! Say we arent interested anymore
    this.peerManager?.setUninterested();
    console.log('Finished downloading, uninterested in other peers');

    this.downloadStream.push(null);
    this.downloadStream.destroy();
  };

  private onPieceValidated = (index: number, offset: number, piece: Buffer) => {
    if (!this.pieceManager.hasPiece(index)) {
      this.pieceManager.setPiece(index, piece);
    }

    console.log('We have validated the piece', index, offset, piece);
    if (!this.downloadStream.destroyed) {
      this.downloadStream.push(Buffer.concat([Buffer.from(`${index}:${offset}:`), piece]));
    }
    this.verifyIsFinishedDownloading();
  };
}
