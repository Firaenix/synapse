import Bitfield from 'bitfield';
import stream from 'stream';
import { inject, injectable } from 'tsyringe';
import { isError } from 'util';

import { MetainfoFile } from '../models/MetainfoFile';
import { IHashService } from './HashService';
import { ILogger } from './interfaces/ILogger';
import { ITorrentDiscovery } from './interfaces/ITorrentDiscovery';
import { MetaInfoService } from './MetaInfoService';
import { Peer } from './Peer';
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

  public addTorrentByInfoSig = (infoSig: Buffer) => {
    this.peerManager.searchByInfoIdentifier(infoSig);
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
    if (!this.metainfoService.metainfo || !this.metainfoService.pieceCount) {
      throw new Error('No metainfo? How did we recieve a piece?');
    }

    this.logger.log('We got piece', index, offset, pieceBuf.length);

    // if (!this.isPieceValid(index, offset, pieceBuf)) {
    //   this.logger.error('Piece is not valid, ask another peer for it', index, offset, pieceBuf.toString('hex'));
    //   await this.peerManager.requestPieceAsync(index, offset, this.metainfoService.pieceCount);
    //   return;
    // }

    // // Piece we recieved is valid, broadcast that I have the piece to other peers, add to downlo
    // this.peerManager.have(index);
    // this.onPieceValidated(index, offset, pieceBuf);
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

    this.logger.log('We have validated the piece', index, offset, piece);
    if (!this.downloadStream.destroyed) {
      this.downloadStream.push(Buffer.concat([Buffer.from(`${index}:${offset}:`), piece]));
    }
    this.verifyIsFinishedDownloading();
  };

  private onBitfield = async (peer: Peer, recievedBitfield: Bitfield) => {
    if (!this.metainfoService.metainfo) {
      throw new Error('Cant recieve bitfield, got no metainfo');
    }

    const pieces = this.metainfoService.metainfo.info.pieces;

    this.logger.log('Bitfield length', recievedBitfield.buffer.length);
    const myBitfield = this.pieceManager.getBitfield();

    const missingPieces = peer.getIndexesThatDontExistInGivenBitfield(myBitfield, pieces.length);
    if (missingPieces.length <= 0) {
      peer.setUninterested();
      this.logger.log('Peer has no pieces that we want, uninterested');
      return;
    }

    this.requestPiecesLoop(peer);
  };

  private chooseNextPieceIndex = (excluding: Array<number> = []): [number, number, number] => {
    if (!this.metainfoService.metainfo) {
      throw new Error('Cant choose next piece, got no metainfo');
    }
    const metainfo = this.metainfoService.metainfo;
    const pieces = this.metainfoService.metainfo.info.pieces;

    const pieceIndex = pieces.findIndex((_, index) => !this.pieceManager.hasPiece(index) && !excluding.includes(index));
    let pieceLength = metainfo.info['piece length'];

    // If last piece, calculate what the correct offset is.
    if (pieceIndex === pieces.length - 1) {
      const totalfileLength = metainfo.info.files.map((x) => x.length).reduce((p, c) => p + c);
      pieceLength = totalfileLength % pieceLength;
    }

    return [pieceIndex, metainfo.info['piece length'] * pieceIndex, pieceLength];
  };

  private onRequest = (peer: Peer, index: number, offset: number, length: number) => {
    this.logger.log('Incoming request ', index, offset, length);

    if (!this.metainfoService.metainfo || !this.metainfoService.pieceCount) {
      throw new Error('Cant recieve request, got no metainfo');
    }

    if (!this.pieceManager.hasPiece(index)) {
      this.logger.log('Oh, I dont have any pieces to send, let all the peers know');
      this.peerManager.broadcastBitfield(this.pieceManager.getBitfield());
      return;
    }

    peer.sendPiece(index, offset, this.pieceManager.getPiece(index));
  };

  private requestPiecesLoop = async (peer: Peer) => {
    try {
      // TODO: Store a map somewhere to say which peers have the pieces we want - PeerManager?
      if (this.metainfoService === undefined) {
        throw new Error('Cannot request pieces if we dont have metainfo');
      }

      const totalPieceCount = this.metainfoService.pieceCount;
      if (!totalPieceCount) {
        throw new Error('How can we not know the total pieceCount?');
      }

      if (this.pieceManager.getPieceCount() >= totalPieceCount) {
        this.logger.warn('Done! I think we have all of the pieces!');
        return;
      }

      const [pieceIndex, pieceOffset, pieceLength] = this.chooseNextPieceIndex();
      const pieceBuf = await peer.request(pieceIndex, pieceOffset, pieceLength);

      if (pieceBuf.length !== pieceLength) {
        throw new Error('pieceBuf.length !== pieceLength');
      }

      if (!this.isPieceValid(pieceIndex, pieceOffset, pieceBuf)) {
        this.logger.error('Piece is not valid, ask another peer for it', pieceIndex, pieceOffset, pieceBuf.toString('hex'));
        throw new Error('PIECE IS NOT VALID');
      }

      this.logger.log('Piece is valid');

      // Piece we recieved is valid, broadcast that I have the piece to other peers, add to downlo
      this.peerManager.have(pieceIndex);
      this.peerManager.cancel(pieceIndex, pieceOffset, pieceLength);
      this.onPieceValidated(pieceIndex, pieceOffset, pieceBuf);

      await this.requestPiecesLoop(peer);
    } catch (error) {
      if (isError(error)) {
        if (error.message === 'request was cancelled') {
          this.logger.info('Request was cancelled.');
          return;
        }
      }

      this.logger.error(error);
    }
  };

  public get metainfo(): MetainfoFile {
    if (!this.metainfoService.metainfo) {
      throw new Error('Do not yet have metainfo');
    }

    return this.metainfoService.metainfo;
  }
}
