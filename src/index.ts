import * as net from 'net';
import bencode from 'bencode';
import { Wire, Extension, HandshakeExtensions, ExtendedHandshake } from '@firaenix/bittorrent-protocol';
import SimplePeer from 'simple-peer';
import wrtc from 'wrtc';
import './typings';
import fs, { promises as fsPromises } from 'fs';
import { createMetaInfo } from './utils/createMetaInfo';
import { SupportedHashAlgorithms } from './models/SupportedHashAlgorithms';
import path from 'path';
import util from 'util';
import { HashService } from './services/HashService';
import { chunkBuffer } from './utils/chunkBuffer';
import Bitfield from 'bitfield';
import { Client } from './Client';
import { MetainfoFile } from './models/MetainfoFile';

const readPath = path.join(__dirname, '..', 'torrents');

const paths = fs.readdirSync(readPath);

const files = paths.map((p) => {
  const filePath = path.join(readPath, p);
  const fileBuf = fs.readFileSync(filePath);
  // fs.writeFileSync('./file-straight-write.epub', fileBuf);

  return {
    file: fileBuf,
    filePath: Buffer.from(p)
  };
});

const metainfoFile = createMetaInfo(files, 'torrents', SupportedHashAlgorithms.sha256);
console.log(metainfoFile);

// const client = new Client();
// client.addMetainfo(metainfoFile)
const hasher = new HashService();
const fullfilearray = files.map((x) => chunkBuffer(x.file, metainfoFile.info['piece length'])).flat();

// fs.writeFileSync('./file-chunked-concat.epub', Buffer.concat(fullfilearray), { encoding: 'utf-8' });
// fs.writeFileSync('./file-mapped.epub', Buffer.concat(files.map((x) => x.file)), { encoding: 'utf-8' });

/**
 * Read comments in here in reverse for the flow
 * @param mePeer
 * @param infoHash
 * @param peerId
 */
const peerFlow = (mePeer: Wire, metaInfo: MetainfoFile, infoHash: string, peerId: string, bitfield: Bitfield, fileBufferChunks?: Buffer[]) => {
  let peerBitfield: Bitfield | undefined;
  const downloadedPieces: Array<Buffer> = [];

  const finishedWithPiece = async (index: number, pieceBuffer: Buffer) => {
    console.log(mePeer.wireName, 'Finished with piece', index);
    downloadedPieces.splice(index, 0, pieceBuffer);
    console.log(mePeer.wireName, 'Downloaded piece length', downloadedPieces.length, 'pieces length', bitfield.buffer.length);

    // Still need more pieces
    if (downloadedPieces.length < metaInfo.info.pieces.length) {
      return;
    }

    // We are done! Say we arent interested anymore
    mePeer.uninterested();
    console.log(mePeer.wireName, 'finished downloading, uninterested');

    const fullFiles = Buffer.concat(downloadedPieces);

    let nextOffset = 0;
    // Split fullFiles into separate buffers based on the length of each file
    for (const file of metaInfo.info.files) {
      console.log(mePeer.wireName, 'Splitting file', file.path.toString(), file.length);

      console.log(mePeer.wireName, 'Reading from offset', nextOffset, 'to', file.length);

      const fileBytes = fullFiles.subarray(nextOffset, file.length + nextOffset);
      console.log(mePeer.wireName, 'Split file:', fileBytes.length);

      if (fileBytes.length !== file.length) {
        throw new Error('Buffer isnt the same length as the file');
      }

      // Create folders if necessary

      await fsPromises.writeFile(`./outputfiles/${file.path}`, fileBytes);
      nextOffset = file.length;
    }

    // Concatenate buffer together and flush to disk.
    // await fsPromises.writeFile('./file.epub', );
    console.log(mePeer.wireName, 'Wrote file to disk', index);
  };

  mePeer.on('piece', async (index: number, offset: number, pieceBuf: Buffer) => {
    console.log('Leecher got piece', index, offset, pieceBuf);

    const algo = metaInfo.info['piece hash algo'];
    const hash = metaInfo.info.pieces[index];
    console.log(mePeer.wireName, ': Checking if piece', index, 'passes', algo, 'check', hash);

    const pieceHash = hasher.hash(pieceBuf, algo);
    console.log(mePeer.wireName, 'Does piece match hash?', pieceHash.equals(hash));

    // Checksum failed - re-request piece
    if (!pieceHash.equals(hash)) {
      mePeer.request(index, offset, metaInfo.info['piece length'], (err) => {
        console.error(mePeer.wireName, 'Error requesting piece again', index, err);
      });
      return;
    }

    // Piece we recieved is valid, broadcast that I have the piece to other peers, add to downlo
    mePeer.have(index);
    console.log(mePeer.wireName, 'Broadcasted that we have piece', index);
    await finishedWithPiece(index, pieceBuf);
  });

  // 4. Recieve have requests
  mePeer.on('request', (index: number, offset: number, length: number) => {
    console.log(mePeer.wireName, 'Incoming request ', index, offset, length);

    if (!fileBufferChunks) {
      console.log(mePeer.wireName, 'Oh, I dont have any pieces to send, update the bitfield and let them know');
      mePeer.bitfield(new Bitfield(metainfoFile.info.pieces.length));
      return;
    }

    mePeer.piece(index, offset, fileBufferChunks[index]);
  });

  // 3. On recieved Bitfield, go through it and remember the pieces that the peer has.
  // Request all the pieces that the peer has but you dont.
  mePeer.on('bitfield', (recievedBitfield: Bitfield) => {
    console.log(mePeer.wireName, 'recieved bitfield from peer', recievedBitfield);
    peerBitfield = recievedBitfield;
    const pieces = metaInfo.info.pieces;

    console.log(mePeer.wireName, 'Bitfield length', recievedBitfield.buffer.length);

    if (pieces.every((_, i) => !peerBitfield?.get(i))) {
      // the peer has no pieces, not interested in talking to you...
      mePeer.uninterested();
      console.log(mePeer.wireName, 'Peer has no pieces, uninterested');
      return;
    }

    for (let index = 0; index < pieces.length; index++) {
      // Do they have a piece?
      const peerHasPiece = peerBitfield.get(index);
      const iHavePiece = bitfield.get(index);

      // Not interested if I have piece
      if (iHavePiece) {
        continue;
      }

      // Not interested if you dont have piece
      if (!peerHasPiece) {
        continue;
      }

      mePeer.request(index, metaInfo.info['piece length'] * index, metaInfo.info['piece length'], (err) => {
        console.error(mePeer.wireName, 'Error requesting piece', index, err);
      });
    }
  });

  // 2. On recieved Extended Handshake (normal handshake follows up with extended handshake), send Bitfield
  mePeer.on('extended', (...data: unknown[]) => {
    console.log(mePeer.wireName, 'Incoming handshake from ', data);

    mePeer.unchoke();
    mePeer.bitfield(bitfield);
  });

  // 1. Send Handshake
  mePeer.handshake(infoHash, peerId);
};

const infoHashString = Buffer.from(metainfoFile.infohash).toString('hex').slice(0, 40);

// const hasher = new HashService();

// This will eventually be a wrapper for WebRTC Peers
(async () => {
  const seedWire = new Wire('seeder');
  const seedBitfield = new Bitfield(metainfoFile.info.pieces.length);
  for (let i = 0; i <= metainfoFile.info.pieces.length; i++) {
    seedBitfield.set(i, true);
  }

  const seederPeerId = Buffer.from(hasher.hash(Buffer.from('seeder'), SupportedHashAlgorithms.sha1)).toString('hex');
  // seedWire.use((w) => new BitcoinExtension(w));
  const leechWire = new Wire('leech');
  const leechPeerId = Buffer.from(hasher.hash(Buffer.from('leech'), SupportedHashAlgorithms.sha1)).toString('hex');

  const seedPeer = new SimplePeer({ wrtc, initiator: true });
  seedPeer.pipe(seedWire).pipe(seedPeer);
  const leechPeer = new SimplePeer({ wrtc });
  leechPeer.pipe(leechWire).pipe(leechPeer);

  seedPeer.on('signal', (data) => {
    console.log('seedPeer', data);
    leechPeer.signal(data);
  });

  leechPeer.on('signal', (data) => {
    console.log('leechPeer', data);
    seedPeer.signal(data);
  });

  peerFlow(seedWire, metainfoFile, infoHashString, seederPeerId, seedBitfield, fullfilearray);
  peerFlow(leechWire, metainfoFile, infoHashString, leechPeerId, new Bitfield(metainfoFile.info.pieces.length));
})();
