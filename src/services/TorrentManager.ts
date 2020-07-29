import { PeerManager } from './PeerManager';
import { MetainfoFile } from '../models/MetainfoFile';
import { IHashService } from './HashService';
import { DiskFile, DownloadedFile } from '../models/DiskFile';
import Bitfield from 'bitfield';
import { chunkBuffer } from '../utils/chunkBuffer';
import { autoInjectable, injectable, inject } from 'tsyringe';
import { PieceManager } from './PieceManager';
import { MetaInfoService } from './MetaInfoService';

@injectable()
export class TorrentManager {
  private onFinishedDownloading: ((downloadedFiles: Array<DownloadedFile>) => void) | undefined;

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
  ) {}

  public startTorrent = (onFinishedDownloading?: (downloadedFiles: Array<DownloadedFile>) => void) => {
    this.onFinishedDownloading = onFinishedDownloading;
    this.peerManager.bootstrapManager(this.onPieceValidated);
  };

  private verifyIsFinishedDownloading = () => {
    console.log('Got', this.pieceManager.getPieceCount(), 'pieces /', this.metainfoService.pieceCount);

    // Still need more pieces
    if (this.pieceManager.getPieceCount() < this.metainfoService.pieceCount) {
      return;
    }

    // We are done! Say we arent interested anymore
    this.peerManager?.setUninterested();
    console.log('Finished downloading, uninterested in other peers');

    const fullFiles = this.pieceManager.getAllPieces();
    const downloadedFiles: Array<DownloadedFile> = [];

    let nextOffset = 0;
    // Split fullFiles into separate buffers based on the length of each file
    for (const file of this.metainfoService.metainfo.info.files) {
      console.log('Splitting file', file.path.toString(), file.length);

      console.log('Reading from offset', nextOffset, 'to', file.length);

      const fileBytes = fullFiles.subarray(nextOffset, file.length + nextOffset);
      console.log('Split file:', fileBytes.length);

      if (fileBytes.length !== file.length) {
        throw new Error('Buffer isnt the same length as the file');
      }

      // const filePath = path.resolve('.', this.metainfo.info.name.toString(), file.path.toString());
      // console.log('Saving to ', filePath);
      // await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
      // // Create folders if necessary
      // await fsPromises.writeFile(filePath, fileBytes);
      downloadedFiles.push({
        file: fileBytes,
        ...file
      });

      nextOffset = nextOffset + file.length;
    }

    this.onFinishedDownloading?.(downloadedFiles);
  };

  private onPieceValidated = (index: number, offset: number, piece: Buffer) => {
    if (!this.pieceManager.hasPiece(index)) {
      this.pieceManager.setPiece(index, piece);
      return;
    }

    console.log('We have validated the piece', index, offset, piece);
    this.verifyIsFinishedDownloading();
  };
}
