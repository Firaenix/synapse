import { Wire, ExtendedHandshake } from '@firaenix/bittorrent-protocol';
import Bitfield from 'bitfield';
import { MetainfoFile } from '../models/MetainfoFile';
import { hasher } from '../index';
import { IHashService } from './HashService';
import { DownloadedFile } from '../models/DiskFile';
import { PieceManager } from './PieceManager';
import { ExtensionsMap } from '@firaenix/bittorrent-protocol/lib/Wire';

export class Peer {
  constructor(
    public readonly wire: Wire,
    private readonly metainfo: MetainfoFile,
    private readonly infoHash: Buffer,
    private readonly pieceManager: PieceManager,
    private readonly myPeerId: Buffer,
    private readonly onPieceValidated?: (index: number, offset: number, piece: Buffer) => void,
    private readonly onErrorCallback?: (e: Error) => void
  ) {
    this.wire.on('error', console.error);

    console.log('Characters in infoHash', Buffer.from(metainfo.infohash).toString('hex'));

    // 5. Recieve the actual data pieces
    this.wire.on('piece', this.onPiece);

    // 4. Recieve have requests
    this.wire.on('request', this.onRequest);

    // 3. On recieved Bitfield, go through it and remember the pieces that the peer has.
    // Request all the pieces that the peer has but you dont.
    this.wire.on('bitfield', this.onBitfield);

    // 2. On recieved Extended Handshake (normal handshake follows up with extended handshake), send Bitfield
    this.wire.on('extended', this.onExtended);

    try {
      // 1. Send Handshake
      this.wire.handshake(this.infoHash, this.myPeerId);
    } catch (error) {
      console.error(error);
    }
  }

  private keepAliveLoop = () => {
    setInterval(() => {
      this.wire.keepAlive();
    }, 1000 * 30);
  };

  private onExtended = (_: string, extensions: ExtendedHandshake) => {
    console.log(this.wire.wireName, 'Incoming handshake from ', extensions, 'Our peerId:', this.myPeerId.toString('hex'), 'Their PeerId:', this.wire.peerId);

    if (this.myPeerId.toString('hex') === this.wire.peerId) {
      console.warn('Dont want to connect to myself, thats weird.');
      this.wire.end();
      return;
    }

    // Make sure we dont disconnect from the peer, keep sending them pings
    this.keepAliveLoop();

    this.wire.unchoke();
    this.wire.bitfield(this.pieceManager.getBitfield());
  };

  private onPiece = async (index: number, offset: number, pieceBuf: Buffer) => {
    console.log('Leecher got piece', index, offset, pieceBuf);

    const algo = this.metainfo.info['piece hash algo'];
    const hash = this.metainfo.info.pieces[index];
    console.log(this.wire.wireName, ': Checking if piece', index, 'passes', algo, 'check', hash);

    const pieceHash = hasher.hash(pieceBuf, algo);
    console.log(this.wire.wireName, 'Does piece match hash?', pieceHash.equals(hash));

    // Checksum failed - re-request piece
    if (!pieceHash.equals(hash)) {
      this.wire.request(index, offset, this.metainfo.info['piece length'], (err) => {
        if (err) {
          console.error(this.wire.wireName, 'Error requesting piece again', index, err);
          this.onErrorCallback?.(err);
        }
      });
      return;
    }

    // Piece we recieved is valid, broadcast that I have the piece to other peers, add to downlo
    this.wire.have(index);
    console.log(this.wire.wireName, 'Broadcasted that we have piece', index, 'this.onPieceValidated function exists?', !!this.onPieceValidated);
    this.onPieceValidated?.(index, offset, pieceBuf);
  };

  private onBitfield = (recievedBitfield: Bitfield) => {
    console.log(this.wire.wireName, 'recieved bitfield from peer', recievedBitfield);
    const pieces = this.metainfo.info.pieces;

    console.log(this.wire.wireName, 'Bitfield length', recievedBitfield.buffer.length);

    if (pieces.every((_, i) => !this.wire.peerPieces.get(i))) {
      // the peer has no pieces, not interested in talking to you...
      this.wire.uninterested();
      console.log(this.wire.wireName, 'Peer has no pieces, uninterested');
      return;
    }

    for (let index = 0; index < pieces.length; index++) {
      // Do they have a piece?
      const peerHasPiece = this.wire.peerPieces.get(index);
      const iHavePiece = this.pieceManager.hasPiece(index);

      // Not interested if I have piece
      if (iHavePiece) {
        continue;
      }

      // Not interested if you dont have piece
      if (!peerHasPiece) {
        continue;
      }

      this.wire.request(index, this.metainfo.info['piece length'] * index, this.metainfo.info['piece length'], (err) => {
        if (err) {
          console.error(this.wire.wireName, 'Error requesting piece', index, err);
          this.onErrorCallback?.(err);
        }
      });
    }
  };

  private onRequest = (index: number, offset: number, length: number) => {
    console.log(this.wire.wireName, 'Incoming request ', index, offset, length);

    if (!this.pieceManager.hasPiece(index)) {
      console.log(this.wire.wireName, 'Oh, I dont have any pieces to send, update the bitfield and let them know');
      this.wire.bitfield(new Bitfield(this.metainfo.info.pieces.length));
      return;
    }

    this.wire.piece(index, offset, this.pieceManager.getPiece(index));
  };
}
