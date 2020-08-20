import Bitfield from 'bitfield';
import { inject, injectable } from 'tsyringe';

import { IHashService } from './HashService';
import { MetaInfoService } from './MetaInfoService';

/**
 * Responsible for managing the Bitfield and Piece Buffers.
 * One of these will exist per torrent.
 * This object will be available globally for a Peer and a Torrent Manager, allows us to update a value in one place and everyone has access to it.
 */
@injectable()
export class PieceManager {
  private bitfield: Bitfield;
  private readonly fileChunks: Array<Buffer>;

  constructor(private readonly metainfoService: MetaInfoService, @inject('IHashService') private readonly hashService: IHashService) {
    if (metainfoService.pieceCount === undefined) {
      throw new Error('metainfoService.pieceCount === undefined');
    }

    this.bitfield = new Bitfield(metainfoService.pieceCount);
    this.fileChunks = metainfoService.fileChunks;

    for (let i = 0; i <= this.fileChunks.length; i++) {
      if (!this.fileChunks[i]) {
        continue;
      }

      this.bitfield.set(i, true);
    }
  }

  public hasPiece = (index: number) => {
    return this.bitfield.get(index);
  };

  private setHasPiece = (index: number, value?: boolean) => {
    return this.bitfield.set(index, value);
  };

  public getBitfield = () => {
    return this.bitfield;
  };

  public getPiece = (index: number) => {
    if (!this.hasPiece(index)) {
      throw new Error(`I dont have the piece you want: ${index}`);
    }

    const pieceBuffer = this.fileChunks[index];
    if (!pieceBuffer) {
      this.setHasPiece(index, false);
      throw new Error(`I dont have the piece you want: ${index}`);
    }

    return this.fileChunks[index];
  };

  public setPiece = (index: number, pieceBuffer: Buffer) => {
    if (!pieceBuffer) {
      throw new Error('No piece was specified');
    }

    if (!this.metainfoService.metainfo) {
      throw new Error('Metainfo must not be undefined so we can set a piece');
    }

    this.setHasPiece(index, true);
    this.fileChunks.splice(index, 0, pieceBuffer);
  };

  public getPieceCount = () => {
    return this.fileChunks.length;
  };
}
