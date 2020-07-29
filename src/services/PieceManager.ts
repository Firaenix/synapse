import Bitfield from 'bitfield';
import { injectable, inject } from 'tsyringe';
import { MetaInfoService } from './MetaInfoService';

/**
 * Responsible for managing the Bitfield and Piece Buffers.
 * One of these will exist per torrent.
 * This object will be available globally for a Peer and a Torrent Manager, allows us to update a value in one place and everyone has access to it.
 */
@injectable()
export class PieceManager {
  private readonly bitfield: Bitfield;
  private readonly pieceChunks: Array<Buffer>;

  constructor(metainfoService: MetaInfoService) {
    this.bitfield = new Bitfield(metainfoService.pieceCount);
    this.pieceChunks = metainfoService.fileChunks;

    for (let i = 0; i <= this.pieceChunks.length; i++) {
      if (!this.pieceChunks[i]) {
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

    const pieceBuffer = this.pieceChunks[index];
    if (!pieceBuffer) {
      this.setHasPiece(index, false);
      throw new Error(`I dont have the piece you want: ${index}`);
    }

    return this.pieceChunks[index];
  };

  public getAllPieces = () => {
    return Buffer.concat(this.pieceChunks);
  };

  public setPiece = (index: number, pieceBuffer: Buffer) => {
    if (!pieceBuffer) {
      throw new Error('No piece was specified');
    }

    this.setHasPiece(index, true);
    this.pieceChunks.splice(index, 0, pieceBuffer);
  };

  public getPieceCount = () => {
    return this.pieceChunks.length;
  };
}
