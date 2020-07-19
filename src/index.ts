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

const torrentFile = fs.readFileSync(path.join(__dirname, '..', 'torrents.torrent'));

console.log(torrentFile.toString());
console.log(util.inspect(bencode.decode(torrentFile), false, null, true));

console.log('=====================================================');

console.log(util.inspect(metainfoFile, false, null, true));
console.log(bencode.encode(metainfoFile).toString());

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

// (async () => {
//   const seedWire = new Wire('seeder');
//   seedWire.use((w) => new BitcoinExtension(w));
//   const leechWire = new Wire('leech');
//   // leechWire.use((w) => new BitcoinExtension(w));

//   seedWire.on('handshake', (...data: unknown[]) => {
//     console.log(seedWire.wireName, 'Incoming handshake from ', data);

//     seedWire.handshake('4444444444444444444430313233343536373839', '4444444444444444444430313233343536373839', { bicoin: true });
//   });

//   seedWire.on('extended', (...data: unknown[]) => {
//     console.log(seedWire.wireName, 'Incoming extended handshake from ', data);
//   });

//   const seedPeer = new SimplePeer({ wrtc, initiator: true });
//   seedPeer.pipe(seedWire).pipe(seedPeer);
//   const leechPeer = new SimplePeer({ wrtc });
//   leechPeer.pipe(leechWire).pipe(leechPeer);

//   seedPeer.on('signal', data => {
//     console.log("seedPeer", data)
//     leechPeer.signal(data);
//   })

//   leechPeer.on('signal', data => {
//     console.log("leechPeer", data)
//     seedPeer.signal(data);
//   })

//   leechWire.on('handshake', (...data: unknown[]) => {
//     console.log(leechWire.wireName, 'Incoming handshake from ', data);
//     leechWire.handshake('3031323334353637383930313233343536373839', '3132333435363738393031323334353637383930');
//   });

//   leechWire.on('extended', (...data: unknown[]) => {
//     console.log(leechWire.wireName, 'Incoming extended handshake from ', data);
//   });

//   leechWire.handshake('3031323334353637383930313233343536373839', '3132333435363738393031323334353637383930');

// })();
