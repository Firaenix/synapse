import '../typings';
import 'reflect-metadata';

import bencode from 'bencode';
import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';

import { Client } from './Client';
import { ED25519KeyPair } from './models/ED25519KeyPair';
import { SignedMetainfoFile } from './models/MetainfoFile';
import { HashService } from './services/HashService';
import { SupportedSignatureAlgorithms } from './services/interfaces/ISigningAlgorithm';
import { ConsoleLogger } from './services/LogLevelLogger';
import { ED25519SuperCopAlgorithm } from './services/signaturealgorithms/ED25519SuperCopAlgorithm';
import { SECP256K1SignatureAlgorithm } from './services/signaturealgorithms/SECP256K1SignatureAlgorithm';
import { SigningService } from './services/SigningService';
import { StreamDownloadService } from './services/StreamDownloadService';
import recursiveReadDir from './utils/recursiveReadDir';

export const hasher = new HashService();
export const signingService = new SigningService([new ED25519SuperCopAlgorithm(), new SECP256K1SignatureAlgorithm(hasher)]);
export const logger = new ConsoleLogger();
export const streamDownloader = new StreamDownloadService(logger);

(async () => {
  const readPath = path.join(__dirname, '..', 'torrents');

  const paths = await recursiveReadDir(readPath);
  const createFilesFromPath = (paths: string[]) => {
    return paths.sort().map((p) => {
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
  };
  const files = createFilesFromPath(paths);

  if (process.env.REGEN === 'true') {
    const { publicKey, secretKey } = await signingService.generateKeyPair(SupportedSignatureAlgorithms.ed25519);

    const serialisedKeys = { secretKey: secretKey.toString('hex'), publicKey: publicKey.toString('hex') };
    fs.writeFileSync('./torrent_keys.ben', bencode.encode(serialisedKeys));

    const sig = await signingService.sign(Buffer.from('text'), SupportedSignatureAlgorithms.ed25519, Buffer.from(secretKey), Buffer.from(publicKey));
    logger.log('SIG', sig);

    const seederMetainfo = await new Client().generateMetaInfo(
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

  const bencodedKeys = fs.readFileSync('./torrent_keys.ben');
  const deserialisedKeys = bencode.decode(bencodedKeys);
  const publicKeyBuffer = Buffer.from(deserialisedKeys.publicKey.toString(), 'hex');
  const secretKeyBuffer = Buffer.from(deserialisedKeys.secretKey.toString(), 'hex');
  const keyPair = new ED25519KeyPair(publicKeyBuffer, secretKeyBuffer);
  if ((await keyPair.isValidKeyPair()) === false) {
    throw new Error('Bail out, not reading keys correctly.');
  }

  if (process.env.SEEDING === 'true') {
    // const seederBitcoinExtension = await GenerateBitcoinExtension('./seedkeys.ben');
    const instance = new Client();
    const torrentManager = await instance.addTorrentByMetainfo(metainfoFile, keyPair, files);

    logger.log('Seeding');
    const changeVersion = 0;
    chokidar.watch(readPath).on('all', async (name, path, stats) => {
      console.log('Path change', name, path, stats);

      const changedPaths = await recursiveReadDir(readPath);
      const changedFiles = createFilesFromPath(changedPaths);

      const { publicKey, secretKey } = keyPair;

      const seederMetainfo = await new Client().generateMetaInfo(
        changedFiles,
        'downoaded_torrents',
        (await import('./models/SupportedHashAlgorithms')).SupportedHashAlgorithms.sha1,
        Buffer.from(secretKey),
        Buffer.from(publicKey)
      );

      if (seederMetainfo.infohash.equals(metainfoFile.infohash)) {
        console.log('Generated same metainfo, ignore');
        return;
      }

      fs.writeFileSync(`./mymetainfo_${changeVersion}.ben`, bencode.encode(seederMetainfo));

      await torrentManager.updateTorrent(keyPair, seederMetainfo);
    });
  }

  if (process.env.LEECHING === 'true') {
    // const leecherBitcoinExtension = await GenerateBitcoinExtension('./leechkeys.ben');
    try {
      const leechInstance = new Client();
      const torrent = await leechInstance.addTorrentByInfoSig(metainfoFile.infosig);
      logger.log('Leeching');

      torrent.metainfo.info;

      streamDownloader.download(torrent, 'downloads');
    } catch (error) {
      logger.fatal(error);
    }
  }
})();
