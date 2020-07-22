import * as net from 'net';
import bencode from 'bencode';
import { Wire, Extension, HandshakeExtensions, ExtendedHandshake } from '@firaenix/bittorrent-protocol';
import SimplePeer from 'simple-peer';
import wrtc from 'wrtc';
import './typings';
import fs from 'fs';
import { createMetaInfo } from './utils/createMetaInfo';
import { SupportedHashAlgorithms } from './models/SupportedHashAlgorithms';
import path from 'path';
import util from 'util';
import { HashService } from './services/HashService';
import { chunkBuffer } from './utils/chunkBuffer';

const readPath = path.join(__dirname, '..', 'torrents');

const paths = fs.readdirSync(readPath);

const files = paths.map((p) => {
  const filePath = path.join(readPath, p);
  const fileBuf = fs.readFileSync(filePath);

  return {
    file: fileBuf,
    filePath: Buffer.from(p)
  };
});

const metainfoFile = createMetaInfo(files, 'torrents', SupportedHashAlgorithms.sha1);
console.log(metainfoFile);
// class BitcoinExtension extends Extension {
//   public name = 'bitcoin';
//   public requirePeer = true;

//   constructor(wire: Wire) {
//     super(wire);
//   }

//   public onHandshake = (infoHash: string, peerId: string, extensions: HandshakeExtensions) => {
//     console.log(this.wire.wireName, 'onHandshake', infoHash, peerId, extensions);
//     this.wire.handshake(infoHash, peerId);
//   };

//   public onExtendedHandshake = (handshake: ExtendedHandshake) => {
//     console.log(this.wire.wireName, 'onExtendedHandshake', handshake);
//   };

//   public onMessage = (buf: Buffer) => {
//     console.log(this.wire.wireName, 'NewExtension incoming', bencode.decode(buf));
//   };
// }

// const seed = (seedWire: Wire) =>
//   new Promise((res) => {

//   });

const infoHashString = Buffer.from(metainfoFile.infohash).toString('hex');
const fileBufferChunks = files.map((x) => chunkBuffer(x.file, metainfoFile.info['piece length'])).flat();
const hasher = new HashService();

(async () => {
  const seedWire = new Wire('seeder');
  const seederPeerId = Buffer.from(hasher.hash(Buffer.from('seeder'), SupportedHashAlgorithms.sha1)).toString('hex');
  // seedWire.use((w) => new BitcoinExtension(w));
  const leechWire = new Wire('leech');
  const leechPeerId = Buffer.from(hasher.hash(Buffer.from('leech'), SupportedHashAlgorithms.sha1)).toString('hex');
  // leechWire.use((w) => new BitcoinExtension(w));

  seedWire.on('handshake', (...data: unknown[]) => {
    console.log(seedWire.wireName, 'Incoming handshake from ', data);

    seedWire.handshake(infoHashString, seederPeerId, { bicoin: true });
  });

  seedWire.on('extended', (...data: unknown[]) => {
    console.log(seedWire.wireName, 'Incoming extended handshake from ', data);
    seedWire.unchoke();
  });

  seedWire.on('request', (index: number, offset: number, length: number) => {
    console.log('SEEDER: Leech requested', index, offset, length);
    seedWire.piece(index, offset, fileBufferChunks[index]);
  });

  seedWire.on('piece', (index: number, offset: number, pieceBuf: Buffer) => {
    console.log('Seeder got piece', index, offset, pieceBuf);
  });

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

  leechWire.on('extended', async (...data: unknown[]) => {
    console.log(leechWire.wireName, 'Incoming extended handshake from ', data);
  });

  leechWire.on('piece', (index: number, offset: number, pieceBuf: Buffer) => {
    console.log('Leecher got piece', index, offset, pieceBuf);

    const algo = metainfoFile.info['piece hash algo'];
    const hash = metainfoFile.info.pieces[index];
    console.log('Leecher: Checking if piece', index, 'passes', algo, 'check', hash);

    const pieceHash = hasher.hash(pieceBuf, algo);
    console.log('Does piece match hash?', pieceHash.equals(hash));
  });

  leechWire.on('unchoke', () => {
    console.log('Leech got unchoke');

    for (let index = 0; index < metainfoFile.info.pieces.length; index++) {
      const piece = metainfoFile.info.pieces[index];
      console.log('leech requests piece', index, piece);

      leechWire.request(index, index * piece.length, piece.length, (...args) => {
        console.log('LEECH REQUEST ARGS', args);
      });
    }
  });

  leechWire.handshake(infoHashString, leechPeerId);
})();
