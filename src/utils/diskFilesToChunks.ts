import { DiskFile } from '../models/DiskFile';
import { chunkBuffer } from './chunkBuffer';

export const diskFilesToChunks = (files: Array<DiskFile>, size: number) => {
  let fileChunks: Array<Buffer> = [];
  // Combine all files into 1 buffer, then chunk.
  const hugeBuffer = files.map((x) => x.file).reduce((prev, curr) => Buffer.concat([prev, curr]));
  fileChunks = chunkBuffer(hugeBuffer, size);

  return fileChunks;
};
