import 'reflect-metadata';
import './typings';
import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import { HashService } from './services/HashService';
import { Client } from './Client';
import recursiveReadDir from './utils/recursiveReadDir';
import elliptic from 'elliptic';
import { DHTService } from './services/DHTService';
import HyperDHT from '@hyperswarm/dht';
import crypto from 'crypto';
import { SigningService } from './services/SigningService';
import { ED25519Algorithm } from './services/signaturealgorithms/ED25519Algorithm';
import { ED25519SuperCopAlgorithm } from './services/signaturealgorithms/ED25519SuperCopAlgorithm';

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
  const { publicKey, secretKey } = await new ED25519SuperCopAlgorithm().generateKeyPair();

  const dht = new DHTService();

  const key = await dht.publish({ publicKey, secretKey }, Buffer.from('JUST SOME SHIT'), 0);
  const value = await dht.get(key);

  console.log('KV', key.toString('hex'), value);

  dht.subscribe(key, 500, (data) => {
    console.log('NEW DATA!', data);
  });

  let nonce = 1;
  setInterval(async () => {
    const newKey = await dht.publish({ publicKey, secretKey }, Buffer.concat([Buffer.from([nonce]), Buffer.from('GIMME DAT NEW SHIET')]), nonce);
    console.log('UPDATED KEY?', newKey.toString('hex'), key.toString('hex'));
    nonce++;
  }, 2000);

  // const metainfoFile = await instance.generateMetaInfo(files, 'downoaded_torrents', SupportedHashAlgorithms.blake3, tempKeyPair.getSecret('hex'));
  // fs.writeFileSync('./mymetainfo.ben', bencode.encode(metainfoFile));
  // instance.addTorrent(metainfoFile, files);

  // const leechInstance = new Client();

  // const torrent = leechInstance.addTorrent(metainfoFile, undefined);
  // const readStream = torrent.downloadStream;

  // const bufs: Array<Buffer> = [];

  // readStream.on('data', (chunk: Buffer) => {
  //   const [index, offset] = chunk.toString().split(':');
  //   console.log('index, offset', index, offset);
  //   bufs.splice(Number(index), 0, chunk.slice(Buffer.from(index).length + Buffer.from(':').length + Buffer.from(offset).length + Buffer.from(':').length));
  // });

  // readStream.on('end', async () => {
  //   const fullFiles = Buffer.concat(bufs);

  //   const downloadedFiles: Array<DownloadedFile> = [];

  //   let nextOffset = 0;
  //   // Split fullFiles into separate buffers based on the length of each file
  //   for (const file of metainfoFile.info.files) {
  //     console.log('Splitting file', file.path.toString(), file.length);

  //     console.log('Reading from offset', nextOffset, 'to', file.length);

  //     const fileBytes = fullFiles.subarray(nextOffset, file.length + nextOffset);
  //     console.log('Split file:', fileBytes.length);

  //     if (fileBytes.length !== file.length) {
  //       throw new Error('Buffer isnt the same length as the file');
  //     }

  //     // const filePath = path.resolve('.', this.metainfo.info.name.toString(), file.path.toString());
  //     // console.log('Saving to ', filePath);
  //     // await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
  //     // // Create folders if necessary
  //     // await fsPromises.writeFile(filePath, fileBytes);
  //     downloadedFiles.push({
  //       file: fileBytes,
  //       ...file
  //     });

  //     nextOffset = nextOffset + file.length;
  //   }

  //   for (const file of downloadedFiles) {
  //     const filePath = path.resolve('.', metainfoFile.info.name.toString(), file.path.toString());
  //     console.log('Saving to ', filePath);
  //     await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
  //     // Create folders if necessary
  //     await fsPromises.writeFile(filePath, file.file);
  //   }
  // });
})();
