import { calculatePieceLength } from './calculatePieceLength';
import { MetainfoFile } from '../models/MetainfoFile';
import { chunkBuffer } from './chunkBuffer';
import { SupportedHashAlgorithms } from '../models/SupportedHashAlgorithms';
import { HashService } from '../services/HashService';

export interface DiskFile {
  file: Uint8Array;
  filePath: Uint8Array;
}

export const createMetaInfo = (diskFiles: DiskFile[], torrentName: string, hashalgo: SupportedHashAlgorithms = SupportedHashAlgorithms.sha1): MetainfoFile => {
  const hasher = new HashService();

  const singleBuf = diskFiles.map((x) => x.file).reduce((p, c) => Buffer.from([...p, ...c]));
  const pieceLength = calculatePieceLength(singleBuf.length);

  const piecesArray: Buffer[] = [];
  for (const diskFile of diskFiles) {
    const fileArray = chunkBuffer(diskFile.file, pieceLength);
    piecesArray.push(fileArray.map((x) => Buffer.from(hasher.hash(x, hashalgo))).reduce((p, c) => Buffer.from([...p, ...c])));
  }

  const files = diskFiles.map((x) => ({ length: x.file.length, path: x.filePath }));

  return {
    info: {
      name: Buffer.from(torrentName),
      pieces: Buffer.from(piecesArray.join('')),
      'piece length': pieceLength,
      'piece hash algo': hashalgo,
      files
    }
  };
};
