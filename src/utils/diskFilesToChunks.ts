import { DiskFile } from '../models/DiskFile';
import { chunkBuffer } from './chunkBuffer';

export const diskFilesToChunks = (files: Array<DiskFile>, size: number) => {
  let fileChunks: Array<Buffer> = [];
  // Combine all files into 1 buffer, then chunk.
  const hugeBuffer = files.map((x) => x.file).reduce((prev, curr) => Buffer.concat([prev, curr]));
  fileChunks = chunkBuffer(hugeBuffer, size);

  const totalFileLength = files.map((x) => x.file.length).reduce((p, c) => p + c);
  if (totalFileLength % size !== fileChunks[fileChunks.length - 1].length) {
    throw new Error('Could not accurately calculate the final piece file length');
  }

  return fileChunks;
};
