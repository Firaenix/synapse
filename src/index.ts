import 'reflect-metadata';
import bencode from 'bencode';
import './typings';
import fs, { promises as fsPromises } from 'fs';
import { createMetaInfo } from './utils/createMetaInfo';
import { SupportedHashAlgorithms } from './models/SupportedHashAlgorithms';
import path from 'path';
import { HashService } from './services/HashService';
import { Client } from './Client';
import recursiveReadDir from './utils/recursiveReadDir';
import { Duplex } from 'stream';
import stream from 'stream';
import { DownloadedFile } from './models/DiskFile';
import eccrypto from 'eccrypto';

export const hasher = new HashService();

(async () => {
  const readPath = path.join(__dirname, '..', 'torrents');

  const paths = await recursiveReadDir(readPath);

  const files = paths.sort().map((p) => {
    console.log(readPath, p);
    const filePath = path.relative('.', p);

    console.log(filePath);
    const fileBuf = fs.readFileSync(filePath);
    // fs.writeFileSync('./file-straight-write.epub', fileBuf);

    return {
      file: fileBuf,
      path: Buffer.from(filePath)
    };
  });

  // new TorrentManager(hasher, metainfoFile, files);

  const instance = new Client();
  const metainfoFile = await instance.generateMetaInfo(files, 'downoaded_torrents', SupportedHashAlgorithms.blake3, eccrypto.generatePrivate());
  fs.writeFileSync('./mymetainfo.ben', bencode.encode(metainfoFile));
  instance.addTorrent(metainfoFile, files);

  const leechInstance = new Client();

  leechInstance.addTorrent(metainfoFile, undefined, (readStream) => {
    const bufs: Array<Buffer> = [];

    readStream.on('data', (chunk: Buffer) => {
      const [index, offset] = chunk.toString().split(':');
      console.log('index, offset', index, offset);
      bufs.splice(Number(index), 0, chunk.slice(Buffer.from(index).length + Buffer.from(':').length + Buffer.from(offset).length + Buffer.from(':').length));
    });

    readStream.on('end', async () => {
      const fullFiles = Buffer.concat(bufs);

      const downloadedFiles: Array<DownloadedFile> = [];

      let nextOffset = 0;
      // Split fullFiles into separate buffers based on the length of each file
      for (const file of metainfoFile.info.files) {
        console.log('Splitting file', file.path.toString(), file.length);

        console.log('Reading from offset', nextOffset, 'to', file.length);

        const fileBytes = fullFiles.subarray(nextOffset, file.length + nextOffset);
        console.log('Split file:', fileBytes.length);

        if (fileBytes.length !== file.length) {
          throw new Error('Buffer isnt the same length as the file');
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

      for (const file of downloadedFiles) {
        const filePath = path.resolve('.', metainfoFile.info.name.toString(), file.path.toString());
        console.log('Saving to ', filePath);
        await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
        // Create folders if necessary
        await fsPromises.writeFile(filePath, file.file);
      }
    });
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

  // for (const file of leecherData) {
  //   const filePath = path.resolve('.', metainfoFile.info.name.toString(), file.path.toString());
  //   console.log('Saving to ', filePath);
  //   await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
  //   // Create folders if necessary
  //   await fsPromises.writeFile(filePath, file.file);
  // }

  // console.log('Leecher data', leecherData);
})();
