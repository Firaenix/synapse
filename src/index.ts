import 'reflect-metadata';
import './typings';
import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import { HashService } from './services/HashService';
import { Client } from './Client';
import recursiveReadDir from './utils/recursiveReadDir';
import { DHTService } from './services/DHTService';
import { ED25519SuperCopAlgorithm } from './services/signaturealgorithms/ED25519SuperCopAlgorithm';
import { SupportedHashAlgorithms } from './models/SupportedHashAlgorithms';
import { DownloadedFile } from './models/DiskFile';
import bencode from 'bencode';
import { LoglevelLogger } from './services/LogLevelLogger';

export const hasher = new HashService();
export const logger = new LoglevelLogger();

(async () => {
  const readPath = path.join(__dirname, '..', 'torrents');

  const paths = await recursiveReadDir(readPath);

  const files = paths.sort().map((p) => {
    logger.log(readPath, p);
    const filePath = path.relative('.', p);

    logger.log(filePath);
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

  const sig = new ED25519SuperCopAlgorithm().sign(Buffer.from('text'), Buffer.from(secretKey), Buffer.from(publicKey));
  logger.log('SIG', sig);

  // const dht = new DHTService(new ED25519SuperCopAlgorithm());

  // const key = await dht.publish({ publicKey, secretKey }, Buffer.alloc(200).fill('whatever'), 0);
  // const value = await dht.get(key);

  // logger.log('KV', key.toString('hex'), value.toString());

  // dht.subscribe(key, 500, (data) => {
  //   logger.log('NEW DATA!', data);
  // });

  // let nonce = 1;
  // setInterval(async () => {
  //   const newKey = await dht.publish({ publicKey, secretKey }, Buffer.concat([Buffer.from([nonce]), Buffer.from('GIMME DAT NEW SHIET')]), nonce);
  //   logger.log('UPDATED KEY?', newKey.toString(), key.toString());
  //   nonce++;
  // }, 2000);

  const metainfoFile = await instance.generateMetaInfo(files, 'downoaded_torrents', SupportedHashAlgorithms.blake3, Buffer.from(secretKey), Buffer.from(publicKey));
  fs.writeFileSync('./mymetainfo.ben', bencode.encode(metainfoFile));
  instance.addTorrent(metainfoFile, files);

  const leechInstance = new Client();

  const torrent = leechInstance.addTorrent(metainfoFile, undefined);
  const readStream = torrent.downloadStream;

  const bufs: Array<Buffer> = [];

  readStream.on('data', (chunk: Buffer) => {
    const [index, offset] = chunk.toString().split(':');
    logger.log('index, offset', index, offset);
    bufs.splice(Number(index), 0, chunk.slice(Buffer.from(index).length + Buffer.from(':').length + Buffer.from(offset).length + Buffer.from(':').length));
  });

  readStream.on('end', async () => {
    const fullFiles = Buffer.concat(bufs);

    const downloadedFiles: Array<DownloadedFile> = [];

    let nextOffset = 0;
    // Split fullFiles into separate buffers based on the length of each file
    for (const file of metainfoFile.info.files) {
      logger.log('Splitting file', file.path.toString(), file.length);

      logger.log('Reading from offset', nextOffset, 'to', file.length);

      const fileBytes = fullFiles.subarray(nextOffset, file.length + nextOffset);
      logger.log('Split file:', fileBytes.length);

      if (fileBytes.length !== file.length) {
        throw new Error('Buffer isnt the same length as the file');
      }

      // const filePath = path.resolve('.', this.metainfo.info.name.toString(), file.path.toString());
      // logger.log('Saving to ', filePath);
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
      logger.log('Saving to ', filePath);
      await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
      // Create folders if necessary
      await fsPromises.writeFile(filePath, file.file);
    }
  });
})();
