import Wire from '@firaenix/bittorrent-protocol';
import Bitfield from 'bitfield';
import stream from 'stream';
import { inject, injectable } from 'tsyringe';

import { Metainfo } from '../models/Metainfo';
import { MetainfoFile } from '../models/MetainfoFile';
import { IHashService } from './HashService';
import { ILogger } from './interfaces/ILogger';
import { ITorrentDiscovery } from './interfaces/ITorrentDiscovery';
import { MetaInfoService } from './MetaInfoService';
import { PeerManager, PeerManagerEvents } from './PeerManager';
import { PieceManager } from './PieceManager';

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
    private readonly pieceManager: PieceManager,
    private readonly metainfoService: MetaInfoService,
    @inject('ITorrentDiscovery')
    private readonly torrentDiscovery: ITorrentDiscovery,
    @inject('ILogger')
    private readonly logger: ILogger
  ) {
    this.downloadStream = new stream.Readable({
      read() {
        return true;
      }
    });

    this.peerManager.on(PeerManagerEvents.got_bitfield, this.onBitfield);
    this.peerManager.on(PeerManagerEvents.got_request, this.onRequest);
    this.peerManager.on(PeerManagerEvents.got_piece, this.onPiece);
  }

  public addTorrent = (metaInfo: MetainfoFile) => {
    if (!metaInfo) {
      throw new Error('Cannot add empty metainfo');
    }
    this.metainfoService.metainfo = metaInfo;

    if (!this.metainfoService.infoIdentifier) {
      throw new Error('Info identifier cannot be empty');
    }

    this.peerManager.searchByInfoIdentifier(this.metainfoService.infoIdentifier);
  };

  public addTorrentByInfoHash = (infoHash: Buffer) => {
    this.peerManager.searchByInfoIdentifier(infoHash);
  };

  private verifyIsFinishedDownloading = () => {
    const pieceCount = this.metainfoService.pieceCount;
    this.logger.log('Got', this.pieceManager.getPieceCount(), 'pieces /', pieceCount);

    if (!pieceCount) {
      throw new Error('No pieces?');
    }

    // Still need more pieces
    if (this.pieceManager.getPieceCount() < pieceCount) {
      return;
    }

    // We are done! Say we arent interested anymore
    this.peerManager?.setUninterested();
    this.logger.log('Finished downloading, uninterested in other peers');

    this.downloadStream.push(null);
    this.downloadStream.destroy();
  };

  private onPiece = async (index: number, offset: number, pieceBuf: Buffer) => {
    // TODO: Need to Verify Piece
    if (!this.metainfoService.metainfo || !this.metainfoService.pieceCount) {
      throw new Error('No metainfo? How did we recieve a piece?');
    }

    this.logger.log('We got piece', index, offset, pieceBuf);

    if (!this.isPieceValid(index, offset, pieceBuf)) {
      this.logger.error('Piece is not valid, ask another peer for it', index, offset, pieceBuf.toString('hex'));
      await this.peerManager.requestPieceAsync(index, offset, this.metainfoService.pieceCount);
      return;
    }

    // Piece we recieved is valid, broadcast that I have the piece to other peers, add to downlo
    this.peerManager.have(index);
    this.onPieceValidated(index, offset, pieceBuf);
  };

  private isPieceValid = (index: number, offset: number, pieceBuf: Buffer): boolean => {
    // TODO: Need to Verify Piece
    if (!this.metainfoService.metainfo) {
      throw new Error('No metainfo? How did we recieve a piece?');
    }

    const algo = this.metainfoService.metainfo.info['piece hash algo'];
    const hash = this.metainfoService.metainfo.info.pieces[index];
    this.logger.log('Checking if piece', index, 'passes', algo, 'check', hash);

    const pieceHash = this.hashService.hash(pieceBuf, algo);
    // Checksum failed - re-request piece
    if (!pieceHash.equals(hash)) {
      return false;
    }

    return true;
  };

  private onPieceValidated = async (index: number, offset: number, piece: Buffer) => {
    if (!this.metainfoService.metainfo || !this.metainfoService.pieceCount) {
      throw new Error('Must have metainfo so we can validate a piece');
    }

    if (!this.pieceManager.hasPiece(index)) {
      this.pieceManager.setPiece(index, piece);
    }

    // Still need more pieces
    const totalPieceCount = this.metainfoService.pieceCount;
    if (this.pieceManager.getPieceCount() < totalPieceCount) {
      const pieceIndex = this.chooseNextPieceIndex();
      const peer = this.peerManager.getPeerThatHasPiece(pieceIndex);

      if (!peer) {
        throw new Error('No peers have the next piece???');
      }

      await this.requestNextPiece(peer.wire, pieceIndex, this.metainfoService.metainfo.info);
    }

    this.logger.log('We have validated the piece', index, offset, piece);
    if (!this.downloadStream.destroyed) {
      this.downloadStream.push(Buffer.concat([Buffer.from(`${index}:${offset}:`), piece]));
    }
    this.verifyIsFinishedDownloading();
  };

  private onBitfield = async (wire: Wire, recievedBitfield: Bitfield) => {
    if (!this.metainfoService.metainfo) {
      throw new Error('Cant recieve bitfield, got no metainfo');
    }

    const pieces = this.metainfoService.metainfo.info.pieces;

    this.logger.log(wire.wireName, 'Bitfield length', recievedBitfield.buffer.length);

    if (pieces.every((_, i) => !wire.peerPieces.get(i))) {
      // the peer has no pieces, not interested in talking to you...
      wire.uninterested();
      this.logger.log(wire.wireName, 'Peer has no pieces, uninterested');
      return;
    }

    const pieceIndex = this.chooseNextPieceIndex();
    this.requestNextPiece(wire, pieceIndex, this.metainfoService.metainfo.info);
  };

  private requestNextPiece = (wire: Wire, pieceIndex: number, metainfo: Metainfo) =>
    new Promise<void>((resolve, reject) => {
      wire.request(pieceIndex, metainfo['piece length'] * pieceIndex, metainfo['piece length'], (err) => {
        if (err) {
          this.logger.error(wire.wireName, 'Error requesting piece, trying again', pieceIndex, err);
          this.requestNextPiece(wire, pieceIndex, metainfo);
          return reject(err);
        }
        return resolve();
      });
    });

  private chooseNextPieceIndex = (excluding: Array<number> = []): number => {
    if (!this.metainfoService.metainfo) {
      throw new Error('Cant choose next piece, got no metainfo');
    }
    const pieces = this.metainfoService.metainfo.info.pieces;

    const pieceIndex = pieces.findIndex((_, index) => !this.pieceManager.hasPiece(index) && !excluding.includes(index));
    return pieceIndex;
  };

  private onRequest = (wire: Wire, index: number, offset: number, length: number) => {
    this.logger.log(wire.wireName, 'Incoming request ', index, offset, length);

    if (!this.metainfoService.metainfo || !this.metainfoService.pieceCount) {
      throw new Error('Cant recieve request, got no metainfo');
    }

    if (!this.pieceManager.hasPiece(index)) {
      this.logger.log(wire.wireName, 'Oh, I dont have any pieces to send, update the bitfield and let them know');
      wire.bitfield(new Bitfield(this.metainfoService.pieceCount));
      return;
    }

    wire.piece(index, offset, this.pieceManager.getPiece(index));
  };

  public get metainfo(): MetainfoFile {
    if (!this.metainfoService.metainfo) {
      throw new Error('Do not yet have metainfo');
    }

    return this.metainfoService.metainfo;
  }
}
