import '../typings';
import 'reflect-metadata';

import bencode from 'bencode';
import fs from 'fs';
import path from 'path';

import { Client } from './Client';
import { UpdateExtension, UpdateManager } from './extensions/Update/UpdateExtension';
import { ED25519KeyPair } from './models/ED25519KeyPair';
import { SignedMetainfoFile } from './models/MetainfoFile';
import { DHTService } from './services/DHTService';
import { HashService } from './services/HashService';
import { SupportedSignatureAlgorithms } from './services/interfaces/ISigningAlgorithm';
import { ConsoleLogger } from './services/LogLevelLogger';
import { ED25519SuperCopAlgorithm } from './services/signaturealgorithms/ED25519SuperCopAlgorithm';
import { SECP256K1SignatureAlgorithm } from './services/signaturealgorithms/SECP256K1SignatureAlgorithm';
import { SigningService } from './services/SigningService';
import { StreamDownloadService } from './services/StreamDownloadService';
import { CreateFilesFromPaths } from './utils/CreateFilesFromPaths';
import recursiveReadDir from './utils/recursiveReadDir';

export const hasher = new HashService();

export const logger = new ConsoleLogger();
export const streamDownloader = new StreamDownloadService(logger);

(async () => {
  try {
    await Client.registerDependencies();
    const signingService = new SigningService([await ED25519SuperCopAlgorithm.build(), new SECP256K1SignatureAlgorithm(hasher)]);

    const readPath = path.join(__dirname, '..', 'torrents');

    const paths = await recursiveReadDir(readPath);
    const files = CreateFilesFromPaths(paths);

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
      const updateManager = new UpdateManager();
      const onUpdateExtensionCreated = (ext: UpdateExtension) => {
        updateManager.addPeerExt(ext);
      };

      // const seederBitcoinExtension = await GenerateBitcoinExtension('./seedkeys.ben');
      const instance = new Client({
        extensions: [
          (ioc) => (w, infoId, metainfo) => {
            return new UpdateExtension(w, infoId, metainfo, ioc.resolve(DHTService)).on('created', onUpdateExtensionCreated);
          }
        ]
      });
      const torrentManager = await instance.addTorrentByMetainfo(metainfoFile, keyPair, files);

      logger.log('Seeding');
      // let changeVersion = 0;
      // chokidar.watch(readPath).on('all', async (name, path, stats) => {
      //   try {
      //     const changedPaths = await recursiveReadDir(readPath);
      //     const changedFiles = CreateFilesFromPaths(changedPaths);

      //     const { publicKey, secretKey } = keyPair;

      //     const seederMetainfo = await new Client().generateMetaInfo(
      //       changedFiles,
      //       'downoaded_torrents',
      //       (await import('./models/SupportedHashAlgorithms')).SupportedHashAlgorithms.sha1,
      //       Buffer.from(secretKey),
      //       Buffer.from(publicKey)
      //     );

      //     if (seederMetainfo.infohash.equals(metainfoFile.infohash)) {
      //       console.log('Generated same metainfo, ignore');
      //       return;
      //     }

      //     console.log('Path change', name, path, stats);
      //     const infoSigSig = await signingService.sign(seederMetainfo.infosig, SupportedSignatureAlgorithms.ed25519, secretKey, publicKey);

      //     changeVersion++;
      //     fs.writeFileSync(`./mymetainfo_${changeVersion}.ben`, bencode.encode(seederMetainfo));
      //     updateManager.broadcastUpdate(seederMetainfo.infosig, publicKey, infoSigSig);
      //   } catch (error) {
      //     console.error(error);
      //   }
      // });
    }

    if (process.env.LEECHING === 'true') {
      // const leecherBitcoinExtension = await GenerateBitcoinExtension('./leechkeys.ben');
      try {
        const leechInstance = new Client({ extensions: [(ioc) => (w, id, meta) => new UpdateExtension(w, id, meta, ioc.resolve(DHTService))] });
        const torrent = await leechInstance.addTorrentByInfoSig(metainfoFile.infosig);
        logger.log('Leeching');

        streamDownloader.download(torrent, 'downloads');
      } catch (error) {
        logger.fatal(error);
      }
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
})();
