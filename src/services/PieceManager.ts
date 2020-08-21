import Bitfield from 'bitfield';
import { inject, injectable } from 'tsyringe';

import { ILogger } from './interfaces/ILogger';
import { MetaInfoService } from './MetaInfoService';

/**
 * Responsible for managing the Bitfield and Piece Buffers.
 * One of these will exist per torrent.
 * This object will be available globally for a Peer and a Torrent Manager, allows us to update a value in one place and everyone has access to it.
 */
@injectable()
export class PieceManager {
  private bitfield: Bitfield;

  constructor(private readonly metainfoService: MetaInfoService, @inject('ILogger') private readonly logger: ILogger) {
    logger.info('PieceManager being created');

    if (metainfoService.pieceCount === undefined) {
      throw new Error('metainfoService.pieceCount === undefined');
    }

    this.bitfield = new Bitfield(metainfoService.pieceCount);

    for (let i = 0; i <= metainfoService.fileChunks.length; i++) {
      if (!this.metainfoService.fileChunks[i]) {
        continue;
      }

      this.bitfield.set(i, true);
    }
  }

  public hasPiece = (index: number) => {
    return this.bitfield.get(index);
  };

  public getBitfield = () => {
    return this.bitfield;
  };

  public getPiece = (index: number) => {
    if (!this.hasPiece(index)) {
      throw new Error(`I dont have the piece you want: ${index}`);
    }

    const pieceBuffer = this.metainfoService.fileChunks[index];
    if (!pieceBuffer) {
      this.bitfield.set(index, false);
      throw new Error(`I dont have the piece you want: ${index}`);
    }

    return this.metainfoService.fileChunks[index];
  };

  public setPiece = (index: number, pieceBuffer: Buffer) => {
    if (!pieceBuffer) {
      throw new Error('No piece was specified');
    }

    if (!this.metainfoService.metainfo) {
      throw new Error('Metainfo must not be undefined so we can set a piece');
    }

    this.bitfield.set(index, true);
    this.metainfoService.fileChunks.splice(index, 0, pieceBuffer);
  };

  public getPieceCount = () => {
    return this.metainfoService.fileChunks.length;
  };
}
