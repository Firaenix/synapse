import { Wire } from '@firaenix/bittorrent-protocol';
import { promises as fsPromises } from 'fs';
import Bitfield from 'bitfield';
import { MetainfoFile } from '../models/MetainfoFile';
import { hasher } from '../index';
import { HashService } from './HashService';
import { SupportedHashAlgorithms } from '../models/SupportedHashAlgorithms';
import { v4 as uuid } from 'uuid';
import { DiskFile, DownloadedFile } from '../models/DiskFile';
import { chunkBuffer } from '../utils/chunkBuffer';
import path from 'path';

export class Peer {
  private downloadedPieces: Array<Buffer> = [];
  private peerId: string;

  constructor(
    private readonly wire: Wire,
    private readonly metainfo: MetainfoFile,
    private readonly infoHash: Buffer,
    private readonly bitfield: Bitfield,
    private readonly fileBufferChunks: Buffer[] | undefined,
    private readonly hashService: HashService,
    private readonly onFinishedCallback?: (data: Array<DownloadedFile>) => void,
    private readonly onErrorCallback?: (e: Error) => void
  ) {
    this.wire.on('error', console.error);

    console.log('Characters in infoHash', Buffer.from(metainfo.infohash).toString('hex'));

    this.peerId = Buffer.from(this.hashService.hash(Buffer.from(uuid()), SupportedHashAlgorithms.sha1)).toString('hex');

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
      this.wire.handshake(this.infoHash, this.peerId);
    } catch (error) {
      console.error(error);
    }
  }

  private finishedWithPiece = async (index: number, pieceBuffer: Buffer) => {
    console.log(this.wire.wireName, 'Finished with piece', index);
    this.downloadedPieces.splice(index, 0, pieceBuffer);

    // Still need more pieces
    if (this.downloadedPieces.length < this.metainfo.info.pieces.length) {
      return;
    }

    // We are done! Say we arent interested anymore
    this.wire.uninterested();
    console.log(this.wire.wireName, 'finished downloading, uninterested');

    const fullFiles = Buffer.concat(this.downloadedPieces);
    const downloadedFiles: Array<DownloadedFile> = [];

    let nextOffset = 0;
    // Split fullFiles into separate buffers based on the length of each file
    for (const file of this.metainfo.info.files) {
      console.log(this.wire.wireName, 'Splitting file', file.path.toString(), file.length);

      console.log(this.wire.wireName, 'Reading from offset', nextOffset, 'to', file.length);

      const fileBytes = fullFiles.subarray(nextOffset, file.length + nextOffset);
      console.log(this.wire.wireName, 'Split file:', fileBytes.length);

      if (fileBytes.length !== file.length) {
        const err = new Error('Buffer isnt the same length as the file');
        this.onErrorCallback?.(err);
        throw err;
      }

      // const filePath = path.resolve('.', this.metainfo.info.name.toString(), file.path.toString());
      // console.log('Saving to ', filePath);
      // await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
      // // Create folders if necessary
      // await fsPromises.writeFile(filePath, fileBytes);
      downloadedFiles.push({
        file: fileBytes,
        ...file
      });

      nextOffset = nextOffset + file.length;
    }

    // Concatenate buffer together and flush to disk.
    // await fsPromises.writeFile('./file.epub', );
    console.log(this.wire.wireName, 'Wrote file to disk', index);
    this.onFinishedCallback?.(downloadedFiles);
  };

  private onExtended = (...data: unknown[]) => {
    console.log(this.wire.wireName, 'Incoming handshake from ', data);

    this.wire.unchoke();
    this.wire.bitfield(this.bitfield);
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
    console.log(this.wire.wireName, 'Broadcasted that we have piece', index);
    await this.finishedWithPiece(index, pieceBuf);
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
      const iHavePiece = this.bitfield.get(index);

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

    if (!this.fileBufferChunks) {
      console.log(this.wire.wireName, 'Oh, I dont have any pieces to send, update the bitfield and let them know');
      this.wire.bitfield(new Bitfield(this.metainfo.info.pieces.length));
      return;
    }

    this.wire.piece(index, offset, this.fileBufferChunks[index]);
  };
}
