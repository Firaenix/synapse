import '../typings';
import 'reflect-metadata';

import bencode from 'bencode';
import fs from 'fs';
import path from 'path';

import { Client } from './Client';
import { SignedMetainfoFile } from './models/MetainfoFile';
import { HashService } from './services/HashService';
import { SupportedSignatureAlgorithms } from './services/interfaces/ISigningAlgorithm';
import { ConsoleLogger } from './services/LogLevelLogger';
import { ED25519SuperCopAlgorithm } from './services/signaturealgorithms/ED25519SuperCopAlgorithm';
import { SigningService } from './services/SigningService';
import { StreamDownloadService } from './services/StreamDownloadService';
import recursiveReadDir from './utils/recursiveReadDir';

export const hasher = new HashService();
export const signingService = new SigningService([new ED25519SuperCopAlgorithm()]);
export const logger = new ConsoleLogger();
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

  if (process.env.REGEN) {
    const seederMetainfo = await instance.generateMetaInfo(
      files,
      'downoaded_torrents',
      (await import('./models/SupportedHashAlgorithms')).SupportedHashAlgorithms.sha1,
      Buffer.from(secretKey),
      Buffer.from(publicKey)
    );
    fs.writeFileSync('./mymetainfo.ben', bencode.encode(seederMetainfo));
  }

  const metainfobuffer = fs.readFileSync('./mymetainfo.ben');
  const metainfoFile = bencode.decode(metainfobuffer) as SignedMetainfoFile;

  if (process.env.SEEDING) {
    instance.addTorrentByMetainfo(metainfoFile, files);

    logger.log('Seeding');
  }

  if (process.env.LEECHING) {
    try {
      const leechInstance = new Client();
      const torrent = await leechInstance.addTorrentByInfoSig(metainfoFile.infosig);
      logger.log('Leeching');
      streamDownloader.download(torrent, 'downloads');
    } catch (error) {
      logger.fatal(error);
    }
  }
})();
