import { PeerManager, PeerManagerEvents } from './PeerManager';
import { MetainfoFile, isSignedMetainfo } from '../models/MetainfoFile';
import { IHashService } from './HashService';
import Bitfield from 'bitfield';
import { injectable, inject } from 'tsyringe';
import { PieceManager } from './PieceManager';
import stream from 'stream';
import Wire from '@firaenix/bittorrent-protocol';

@injectable()
export class TorrentManager {
  public downloadStream: stream.Readable;
  public metainfo: MetainfoFile | undefined;
  public infoIdentifier: Buffer | undefined;

  /**
   * if files is undefined, you are a leech, seeders have all the data
   * @param peerDiscovery
   * @param hashService
   * @param metainfoFile
   * @param files
   */
  constructor(@inject('IHashService') private readonly hashService: IHashService, private readonly peerManager: PeerManager, private readonly pieceManager: PieceManager) {
    this.downloadStream = new stream.Readable({
      read() {
        return true;
      }
    });

    this.peerManager.on(PeerManagerEvents.got_bitfield, this.onBitfield);
    this.peerManager.on(PeerManagerEvents.got_request, this.onRequest);
    this.peerManager.on(PeerManagerEvents.valid_piece, this.onPieceValidated);
  }

  public addTorrent = (metaInfo: MetainfoFile) => {
    this.metainfo = metaInfo;
    this.infoIdentifier = metaInfo.infohash;

    if (isSignedMetainfo(metaInfo)) {
      this.infoIdentifier = metaInfo.infosig;
    }

    this.peerManager.searchByInfoIdentifier(this.infoIdentifier);
  };

  private verifyIsFinishedDownloading = () => {
    const pieceCount = this.metainfo?.info.pieces.length;
    console.log('Got', this.pieceManager.getPieceCount(), 'pieces /', pieceCount);

    if (!pieceCount) {
      throw new Error('No pieces?');
    }

    // Still need more pieces
    if (this.pieceManager.getPieceCount() < pieceCount) {
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

  private onBitfield = (wire: Wire, recievedBitfield: Bitfield) => {
    if (!this.metainfo) {
      throw new Error('Cant recieve bitfield, got no metainfo');
    }

    const pieces = this.metainfo.info.pieces;

    console.log(wire.wireName, 'Bitfield length', recievedBitfield.buffer.length);

    if (pieces.every((_, i) => !wire.peerPieces.get(i))) {
      // the peer has no pieces, not interested in talking to you...
      wire.uninterested();
      console.log(wire.wireName, 'Peer has no pieces, uninterested');
      return;
    }

    //

    for (let index = 0; index < pieces.length; index++) {
      // Do they have a piece?
      const peerHasPiece = wire.peerPieces.get(index);
      const iHavePiece = this.pieceManager.hasPiece(index);

      // Not interested if I have piece
      if (iHavePiece) {
        continue;
      }

      // Not interested if you dont have piece
      if (!peerHasPiece) {
        continue;
      }

      wire.request(index, this.metainfo.info['piece length'] * index, this.metainfo.info['piece length'], (err) => {
        if (err) {
          console.error(wire.wireName, 'Error requesting piece', index, err);
          throw new Error(err);
        }
      });
    }
  };

  private onRequest = (wire: Wire, index: number, offset: number, length: number) => {
    console.log(wire.wireName, 'Incoming request ', index, offset, length);

    if (!this.metainfo) {
      throw new Error('Cant recieve request, got no metainfo');
    }

    if (!this.pieceManager.hasPiece(index)) {
      console.log(wire.wireName, 'Oh, I dont have any pieces to send, update the bitfield and let them know');
      wire.bitfield(new Bitfield(this.metainfo.info.pieces.length));
      return;
    }

    wire.piece(index, offset, this.pieceManager.getPiece(index));
  };
}
