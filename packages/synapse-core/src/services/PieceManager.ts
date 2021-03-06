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

  private peerBitfields: { [peerId: string]: Bitfield } = {};

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

  public clearPieces = () => {
    this.bitfield = new Bitfield();
    this.metainfoService.fileChunks = [];
  };

  public addPeerBitfield = (peerId: string, recievedBitfield: Bitfield) => {
    this.peerBitfields[peerId] = recievedBitfield;
  };

  public hasPiece = (index: number) => {
    return this.bitfield.get(index);
  };

  public getBitfield = () => {
    return this.bitfield;
  };

  public getNextNeededPiece = (excluding: Array<number> = []) => {
    if (!this.metainfoService.metainfo) {
      throw new Error('Cant choose next piece, got no metainfo');
    }
    const metainfo = this.metainfoService.metainfo;
    const pieces = this.metainfoService.metainfo.info.pieces;

    const pieceIndex = pieces.findIndex((_, index) => !this.hasPiece(index) && !excluding.includes(index));
    let pieceLength = metainfo.info['piece length'];

    // If last piece, calculate what the correct offset is.
    if (pieceIndex === pieces.length - 1) {
      const totalfileLength = metainfo.info.files.map((x) => x.length).reduce((p, c) => p + c);
      pieceLength = totalfileLength % pieceLength;
    }

    return [pieceIndex, metainfo.info['piece length'] * pieceIndex, pieceLength];
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
