import 'reflect-metadata';
import bencode from 'bencode';
import './typings';
import fs, { promises as fsPromises } from 'fs';
import { Client } from './Client';
import path from 'path';

(async () => {
  // const readPath = path.join(__dirname, '..', 'torrents');

  // const paths = await recursiveReadDir(readPath);

  // const files = paths.sort().map((p) => {
  //   console.log(readPath, p);
  //   const filePath = path.relative('.', p);

  //   console.log(filePath);
  //   const fileBuf = fs.readFileSync(filePath);
  //   // fs.writeFileSync('./file-straight-write.epub', fileBuf);

  //   return {
  //     file: fileBuf,
  //     path: Buffer.from(filePath)
  //   };
  // });

  // const metainfoFile = createMetaInfo(files, 'downoaded_torrents', SupportedHashAlgorithms.blake3);

  const metainfoFile = bencode.decode(fs.readFileSync('./mymetainfo.ben'));

  // new TorrentManager(hasher, metainfoFile, files);

  const instance = new Client();

  let downloadedCount = 0;
  instance.addTorrent(metainfoFile, undefined, async (downloads) => {
    downloadedCount++;
    console.log('Downloaded!', downloads);
    console.log('Downloaded count', downloadedCount);

    for (const file of downloads) {
      const filePath = path.resolve('.', metainfoFile.info.name.toString(), file.path.toString());
      console.log('Saving to ', filePath);
      await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
      // Create folders if necessary
      await fsPromises.writeFile(filePath, file.file);
    }
  });

  // const seedWire = new Wire('seeder');
  // const seedBitfield = new Bitfield(metainfoFile.info.pieces.length);
  // for (let i = 0; i <= metainfoFile.info.pieces.length; i++) {
  //   seedBitfield.set(i, true);
  // }

  // // seedWire.use((w) => new BitcoinExtension(w));
  // const leechWire = new Wire('leech');

  // const seedPeer = new SimplePeer({ wrtc, initiator: true });
  // seedPeer.pipe(seedWire).pipe(seedPeer);

  // const leechPeer = new SimplePeer({ wrtc });
  // leechPeer.pipe(leechWire).pipe(leechPeer);

  // // const seedTorrent = new TorrentInstance(metainfoFile, seedWire, files, hasher);
  // // const leechTorrent = new TorrentInstance(metainfoFile, leechWire, undefined, hasher);

  // seedPeer.on('signal', (data) => {
  //   // console.log('seedPeer', data);
  //   leechPeer.signal(data);
  // });

  // leechPeer.on('signal', (data) => {
  //   // console.log('leechPeer', data);
  //   seedPeer.signal(data);
  // });

  // // seedTorrent.addPeer();
  // // leechTorrent.addPeer();

  // new Peer(seedWire, metainfoFile, hasher, files);
  // const leecherData = await new Promise<Array<DownloadedFile>>((res, reject) => new Peer(leechWire, metainfoFile, hasher, undefined, res, reject));
})();
