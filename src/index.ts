import '../typings';
import 'reflect-metadata';

import Wire from '@firaenix/bittorrent-protocol';
import bencode from 'bencode';
import fs from 'fs';
import path from 'path';
import { DependencyContainer } from 'tsyringe';

import { Client } from './Client';
import { BitcoinExtension } from './extensions/Bitcoin';
import { EchoExtension } from './extensions/EchoExtension';
import { MetadataExtension } from './extensions/Metadata';
import { SignedMetainfoFile } from './models/MetainfoFile';
import { SECP256K1KeyPair } from './models/SECP256K1KeyPair';
import { HashService, IHashService } from './services/HashService';
import { ILogger } from './services/interfaces/ILogger';
import { SupportedSignatureAlgorithms } from './services/interfaces/ISigningAlgorithm';
import { ISigningService } from './services/interfaces/ISigningService';
import { ConsoleLogger } from './services/LogLevelLogger';
import { MetaInfoService } from './services/MetaInfoService';
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

  const defaultExtensions = [
    (ioc: DependencyContainer) => (w: Wire) =>
      new MetadataExtension(
        w,
        ioc.resolve(MetaInfoService).infoIdentifier!,
        ioc.resolve(MetaInfoService),
        ioc.resolve<IHashService>('IHashService'),
        ioc.resolve<ISigningService>('ISigningService'),
        ioc.resolve<ILogger>('ILogger')
      ),
    (ioc: DependencyContainer) => (w: Wire) => new EchoExtension(w, ioc.resolve<ILogger>('ILogger'))
  ];

  if (process.env.REGEN) {
    const { publicKey, secretKey } = await signingService.generateKeyPair(SupportedSignatureAlgorithms.ed25519);

    const sig = await signingService.sign(Buffer.from('text'), SupportedSignatureAlgorithms.ed25519, Buffer.from(secretKey), Buffer.from(publicKey));
    logger.log('SIG', sig);

    const seederMetainfo = await new Client({ extensions: defaultExtensions }).generateMetaInfo(
      files,
      'downoaded_torrents',
      (await import('./models/SupportedHashAlgorithms')).SupportedHashAlgorithms.sha1,
      Buffer.from(secretKey),
      Buffer.from(publicKey)
    );
    fs.writeFileSync('./mymetainfo.ben', bencode.encode(seederMetainfo));

    const seederBitcoinKeys = await signingService.generateKeyPair(SupportedSignatureAlgorithms.secp256k1);
    const seederSerialised = { secretKey: seederBitcoinKeys.secretKey.toString('hex'), publicKey: seederBitcoinKeys.publicKey.toString('hex') };
    fs.writeFileSync('./seedkeys.ben', bencode.encode(seederSerialised));
    const leecherBitcoinKeys = await signingService.generateKeyPair(SupportedSignatureAlgorithms.secp256k1);
    const leecherSerialised = { secretKey: leecherBitcoinKeys.secretKey.toString('hex'), publicKey: leecherBitcoinKeys.publicKey.toString('hex') };
    // console.log('Leecher', leecherSerialised.secretKey);
    console.log('Seeder', seederSerialised.secretKey);
    fs.writeFileSync('./leechkeys.ben', bencode.encode(leecherSerialised));
  }

  const metainfobuffer = fs.readFileSync('./mymetainfo.ben');
  const metainfoFile = bencode.decode(metainfobuffer) as SignedMetainfoFile;

  const seederKeysBen = fs.readFileSync('./seedkeys.ben');
  const seederBitcoinKeys = bencode.decode(seederKeysBen);
  console.log('seederBitcoinKeys private', seederBitcoinKeys.secretKey.toString());

  const leecherKeysBen = fs.readFileSync('./leechkeys.ben');
  const leecherBitcoinKeys = bencode.decode(leecherKeysBen);
  // console.log('leecherBitcoinKeys private', leecherBitcoinKeys.secretKey.toString());

  const seederBitcoinExtension = (ioc: DependencyContainer) => (w: Wire) =>
    new BitcoinExtension(
      w,
      {
        getPrice: (index, offset, length) => {
          // 1sat for every 10KB
          const kb = length / 1000;
          return Math.ceil(kb);
        },
        keyPair: new SECP256K1KeyPair(Buffer.from(seederBitcoinKeys.publicKey.toString(), 'hex'), Buffer.from(seederBitcoinKeys.secretKey.toString(), 'hex'))
      },
      ioc.resolve(SECP256K1SignatureAlgorithm),
      ioc.resolve<ILogger>('ILogger')
    );

  if (process.env.SEEDING) {
    const instance = new Client({ extensions: [...defaultExtensions] });
    instance.addTorrentByMetainfo(metainfoFile, files);

    logger.log('Seeding');
  }

  const leecherBitcoinExtension = (ioc: DependencyContainer) => (w: Wire) =>
    new BitcoinExtension(
      w,
      {
        getPrice: (index, offset, length) => {
          // 1sat for every 10KB
          const kb = length / 1000;
          return Math.ceil(kb);
        },
        keyPair: new SECP256K1KeyPair(Buffer.from(leecherBitcoinKeys.publicKey.toString(), 'hex'), Buffer.from(leecherBitcoinKeys.secretKey.toString(), 'hex'))
      },
      ioc.resolve(SECP256K1SignatureAlgorithm),
      ioc.resolve<ILogger>('ILogger')
    );

  if (process.env.LEECHING) {
    try {
      const leechInstance = new Client({ extensions: [...defaultExtensions] });
      const torrent = await leechInstance.addTorrentByInfoSig(metainfoFile.infosig);
      logger.log('Leeching');
      streamDownloader.download(torrent, 'downloads');
    } catch (error) {
      logger.fatal(error);
    }
  }
})();
