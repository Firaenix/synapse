export const chunkBuffer = (buf: Buffer, size: number, shouldPad?: boolean): Array<Buffer> => {
  const bufferChunks: Array<Buffer> = [];

  for (let index = 0; index < buf.length; ) {
    let nextChunk = buf.slice(index, size + index);

    if (shouldPad && nextChunk.length < size) {
      // Pad out the chunk with zeroes
      const padding = size - nextChunk.length;
      nextChunk = Buffer.from([...nextChunk, ...Array(padding).fill(0, 0, padding)]);
    }

    bufferChunks.push(nextChunk);
    index += size;
  }

  return bufferChunks;
};
