import '../typings';
import 'reflect-metadata';

import bencode from 'bencode';
import fs from 'fs';
import path from 'path';

import { Client } from './Client';
import { SignedMetainfoFile } from './models/MetainfoFile';
import { SupportedHashAlgorithms } from './models/SupportedHashAlgorithms';
import { HashService } from './services/HashService';
import { SupportedSignatureAlgorithms } from './services/interfaces/ISigningAlgorithm';
import { LoglevelLogger } from './services/LogLevelLogger';
import { ED25519SuperCopAlgorithm } from './services/signaturealgorithms/ED25519SuperCopAlgorithm';
import { SigningService } from './services/SigningService';
import { StreamDownloadService } from './services/StreamDownloadService';
import recursiveReadDir from './utils/recursiveReadDir';

export const hasher = new HashService();
export const signingService = new SigningService([new ED25519SuperCopAlgorithm()]);
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
  const { publicKey, secretKey } = await signingService.generateKeyPair(SupportedSignatureAlgorithms.ed25519);

  const sig = await signingService.sign(Buffer.from('text'), SupportedSignatureAlgorithms.ed25519, Buffer.from(secretKey), Buffer.from(publicKey));
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

  const seederMetainfo = await instance.generateMetaInfo(files, 'downoaded_torrents', SupportedHashAlgorithms.sha1, Buffer.from(secretKey), Buffer.from(publicKey));
  fs.writeFileSync('./mymetainfo.ben', bencode.encode(seederMetainfo));
  instance.addTorrentByMetainfo(seederMetainfo, files);

  logger.log('Seeding');

  const metainfobuffer = fs.readFileSync('./mymetainfo.ben');
  const metainfoFile = bencode.decode(metainfobuffer) as SignedMetainfoFile;

  try {
    const leechInstance = new Client();
    const torrent = await leechInstance.addTorrentByInfoSig(metainfoFile.infosig);
    logger.log('Leeching');
    streamDownloader.download(torrent, 'downloads');
  } catch (error) {
    logger.fatal(error);
  }
})();
