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
  private readonly bitfield: Bitfield;
  private readonly hashChunks: Array<Buffer>;

  constructor(private readonly metainfoService: MetaInfoService, @inject('IHashService') private readonly hashService: IHashService) {
    this.bitfield = new Bitfield(metainfoService.pieceCount);
    this.hashChunks = metainfoService.fileChunks;

    for (let i = 0; i <= this.hashChunks.length; i++) {
      if (!this.hashChunks[i]) {
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

    const pieceBuffer = this.hashChunks[index];
    if (!pieceBuffer) {
      this.setHasPiece(index, false);
      throw new Error(`I dont have the piece you want: ${index}`);
    }

    return this.hashChunks[index];
  };

  public setPiece = (index: number, pieceBuffer: Buffer) => {
    if (!pieceBuffer) {
      throw new Error('No piece was specified');
    }

    if (!this.metainfoService.metainfo) {
      throw new Error('Metainfo must not be undefined so we can set a piece');
    }

    this.setHasPiece(index, true);
    this.hashChunks.splice(index, 0, this.hashService.hash(pieceBuffer, this.metainfoService.metainfo.info['piece hash algo']));
  };

  public getPieceCount = () => {
    return this.hashChunks.length;
  };
}
