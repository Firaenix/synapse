import { calculatePieceLength } from './calculatePieceLength';
import { MetainfoFile } from '../models/MetainfoFile';
import { chunkBuffer } from './chunkBuffer';
import { SupportedHashAlgorithms } from '../models/SupportedHashAlgorithms';
import { HashService } from '../services/HashService';
import { Metainfo } from '../models/Metainfo';
import bencode from 'bencode';
import { DiskFile } from '../models/DiskFile';

export const createMetaInfo = (diskFiles: DiskFile[], torrentName: string, hashalgo: SupportedHashAlgorithms = SupportedHashAlgorithms.sha1): MetainfoFile => {
  const hasher = new HashService();

  const singleBuf = diskFiles.map((x) => x.file).reduce((p, c) => Buffer.from([...p, ...c]));
  const pieceLength = calculatePieceLength(singleBuf.length);

  let piecesArray: Buffer[] = [];
  for (const diskFile of diskFiles) {
    const fileArray = chunkBuffer(diskFile.file, pieceLength);
    const fileHashPieces = fileArray.map((x) => Buffer.from(hasher.hash(x, hashalgo)));
    piecesArray = piecesArray.concat(fileHashPieces);
  }

  const files = diskFiles.map((x) => ({ length: x.file.length, path: x.filePath }));

  const metaInfo: Metainfo = {
    name: Buffer.from(torrentName),
    pieces: piecesArray,
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
