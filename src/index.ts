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
import { StreamDownloadService } from './services/StreamDownloadService';

export const hasher = new HashService();
export const logger = new LoglevelLogger();
export const streamDownloader = new StreamDownloadService(logger);

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

  const metainfoFile = await instance.generateMetaInfo(files, 'downoaded_torrents', SupportedHashAlgorithms.sha1, Buffer.from(secretKey), Buffer.from(publicKey));
  fs.writeFileSync('./mymetainfo.ben', bencode.encode(metainfoFile));
  instance.addTorrent(metainfoFile, files);

  const leechInstance = new Client();

  const torrent = leechInstance.addTorrent(metainfoFile, undefined);
  streamDownloader.download(torrent, '');
})();
