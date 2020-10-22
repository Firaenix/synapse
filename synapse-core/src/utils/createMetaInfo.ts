import bencode from 'bencode';

import { DiskFile } from '../models/DiskFile';
import { Metainfo } from '../models/Metainfo';
import { MetainfoFile } from '../models/MetainfoFile';
import { SupportedHashAlgorithms } from '../models/SupportedHashAlgorithms';
import { SHA1HashAlgorithm } from '../services/hashalgorithms/SHA1HashAlgorithm';
import { SHA256HashAlgorithm } from '../services/hashalgorithms/SHA256HashAlgorithm';
import { HashService } from '../services/HashService';
import { calculatePieceLength } from './calculatePieceLength';
import { diskFilesToChunks } from './diskFilesToChunks';

export const createMetaInfo = (diskFiles: DiskFile[], torrentName: string, hashalgo: SupportedHashAlgorithms = SupportedHashAlgorithms.sha1): MetainfoFile => {
  const hasher = new HashService([new SHA1HashAlgorithm(), new SHA256HashAlgorithm()]);

  const totalFileLength = diskFiles.map((x) => x.file.length).reduce((p, c) => p + c);
  const pieceLength = calculatePieceLength(totalFileLength);
  const chunks = diskFilesToChunks(diskFiles, pieceLength);
  const pieces = chunks.map((x) => Buffer.from(hasher.hash(x, hashalgo)));

  const files = diskFiles.map((x) => ({ length: x.file.length, path: x.path }));

  const metaInfo: Metainfo = {
    name: Buffer.from(torrentName),
    pieces,
    'piece length': pieceLength,
    'piece hash algo': hashalgo,
    files
  };

  // to get infohash, metainfo to bencode buffer then hash
  const bencodedMetaInfo = bencode.encode(metaInfo);
  const infohash = hasher.hash(bencodedMetaInfo, hashalgo);

  return {
    info: metaInfo,
    infohash
  };
};
