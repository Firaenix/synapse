import { MetainfoFile } from '../models/MetainfoFile';
import { Wire } from '@firaenix/bittorrent-protocol';
import { HashService } from './HashService';
import { chunkBuffer } from '../utils/chunkBuffer';
import { DiskFile } from '../models/DiskFile';
import { v4 as uuid } from 'uuid';
import { SupportedHashAlgorithms } from '../models/SupportedHashAlgorithms';
import Bitfield from 'bitfield';
import { promises as fsPromises } from 'fs';
import { Duplex } from 'readable-stream';

/**
 * Keeps track of the status of a torrent along with storing references to all peers
 */
export class TorrentInstance {
  private readonly infoHashString: string;
  private readonly fileBufferChunks: Buffer[] | undefined;
  private readonly peerId: string;
  private readonly bitfield: Bitfield;
  private peerBitfield: Bitfield;
  private downloadedPieces: Array<Buffer> = [];

  constructor(private metainfo: MetainfoFile, private wire: Wire, files: DiskFile[] | undefined, private hashService: HashService) {
    this.infoHashString = Buffer.from(metainfo.infohash).toString('hex');
    this.peerId = this.hashService.hash(Buffer.from(uuid()), SupportedHashAlgorithms.sha1).toString('hex');
    this.bitfield = new Bitfield(metainfo.info.pieces.length);

    if (files) {
      this.fileBufferChunks = files.map((x) => chunkBuffer(x.file, metainfo.info['piece length'])).flat();

      // Mark that we have all the bits
      for (let i = 0; i <= this.fileBufferChunks.length; i++) {
        this.bitfield.set(i, true);
      }
    }
  }

  public addPeer() {
    console.log(this.wire);

    // 5. Recieve the actual pieces
    this.wire.on('piece', this.onPiece);

    // 4. Recieve have requests
    this.wire.on('request', this.onRequest);

    // 3. On recieved Bitfield, go through it and remember the pieces that the peer has.
    // Request all the pieces that the peer has but you dont.
    this.wire.on('bitfield', this.onBitfield);

    // 2. On recieved Extended Handshake (normal handshake follows up with extended handshake), send Bitfield
    this.wire.on('extended', this.onExtended);

    // 1. Send Handshake
    this.wire.handshake(this.infoHashString, this.peerId);
    console.log(this.wire.wireName, 'sent handshake');
  }

  private onExtended(...data: unknown[]) {
    console.log(this.wire?.wireName, 'Incoming handshake from ', data);

    this.wire?.unchoke();
    this.wire?.bitfield(this.bitfield);
  }

  private onBitfield(recievedBitfield: Bitfield) {
    console.log(this.wire?.wireName, 'recieved bitfield from peer', recievedBitfield);
    this.peerBitfield = recievedBitfield;
    const pieces = this.metainfo.info.pieces;

    console.log(this.wire?.wireName, 'Bitfield length', recievedBitfield.buffer.length);

    if (pieces.every((_, i) => !this.peerBitfield?.get(i))) {
      // the peer has no pieces, not interested in talking to you...
      this.wire?.uninterested();
      console.log(this.wire?.wireName, 'Peer has no pieces, uninterested');
      return;
    }

    for (let index = 0; index < pieces.length; index++) {
      // Do they have a piece?
      const peerHasPiece = this.peerBitfield.get(index);
      const iHavePiece = this.bitfield.get(index);

      // Not interested if I have piece
      if (iHavePiece) {
        continue;
      }

      // Not interested if you dont have piece
      if (!peerHasPiece) {
        continue;
      }

      this.wire?.request(index, this.metainfo.info['piece length'] * index, this.metainfo.info['piece length'], (err) => {
        console.error(this.wire?.wireName, 'Error requesting piece', index, err);
      });
    }
  }

  private onRequest(index: number, offset: number, length: number) {
    console.log(this.wire?.wireName, 'Incoming request ', index, offset, length);

    if (!this.fileBufferChunks) {
      console.log(this.wire?.wireName, 'Oh, I dont have any pieces to send, update the bitfield and let them know');
      this.wire?.bitfield(new Bitfield(this.metainfo.info.pieces.length));
      return;
    }

    this.wire?.piece(index, offset, this.fileBufferChunks[index]);
  }

  private async onPiece(index: number, offset: number, pieceBuf: Buffer) {
    console.log('Leecher got piece', index, offset, pieceBuf);

    const algo = this.metainfo.info['piece hash algo'];
    const hash = this.metainfo.info.pieces[index];
    console.log(this.wire?.wireName, ': Checking if piece', index, 'passes', algo, 'check', hash);

    const pieceHash = this.hashService.hash(pieceBuf, algo);
    console.log(this.wire?.wireName, 'Does piece match hash?', pieceHash.equals(hash));

    // Checksum failed - re-request piece
    if (!pieceHash.equals(hash)) {
      this.wire?.request(index, offset, this.metainfo.info['piece length'], (err) => {
        console.error(this.wire?.wireName, 'Error requesting piece again', index, err);
      });
      return;
    }

    // Piece we recieved is valid, broadcast that I have the piece to other peers, add to downlo
    this.wire?.have(index);
    console.log(this.wire?.wireName, 'Broadcasted that we have piece', index);
    await this.finishedWithPiece(index, pieceBuf);
  }

  private async finishedWithPiece(index: number, pieceBuffer: Buffer) {
    console.log(this.wire?.wireName, 'Finished with piece', index);
    this.downloadedPieces.splice(index, 0, pieceBuffer);
    console.log(this.wire?.wireName, 'Downloaded piece length', this.downloadedPieces.length, 'pieces length', this.bitfield.buffer.length);

    // Still need more pieces
    if (this.downloadedPieces.length < this.metainfo.info.pieces.length) {
      return;
    }

    // We are done! Say we arent interested anymore
    this.wire?.uninterested();
    console.log(this.wire?.wireName, 'finished downloading, uninterested');

    const fullFiles = Buffer.concat(this.downloadedPieces);

    let nextOffset = 0;
    // Split fullFiles into separate buffers based on the length of each file
    for (const file of this.metainfo.info.files) {
      console.log(this.wire?.wireName, 'Splitting file', file.path.toString(), file.length);

      console.log(this.wire?.wireName, 'Reading from offset', nextOffset, 'to', file.length);

      const fileBytes = fullFiles.subarray(nextOffset, file.length + nextOffset);
      console.log(this.wire?.wireName, 'Split file:', fileBytes.length);

      if (fileBytes.length !== file.length) {
        throw new Error('Buffer isnt the same length as the file');
      }

      // Create folders if necessary

      await fsPromises.writeFile(`./outputfiles/${file.path}`, fileBytes);
      nextOffset = file.length;
    }

    // Concatenate buffer together and flush to disk.
    // await fsPromises.writeFile('./file.epub', );
    console.log(this.wire?.wireName, 'Wrote file to disk', index);
  }
}
