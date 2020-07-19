export const chunkBuffer = (buf: Uint8Array, size: number, shouldPad?: boolean): Array<Uint8Array> => {
  const bufferChunks: Array<Uint8Array> = [];

  for (let index = 0; index < buf.length; ) {
    let nextChunk = buf.slice(index, size + index);

    if (shouldPad && nextChunk.length < size) {
      // Pad out the chunk with zeroes
      const padding = size - nextChunk.length;
      nextChunk = Uint8Array.from([...nextChunk, ...Array(padding).fill(0, 0, padding)]);
    }

    bufferChunks.push(nextChunk);
    index += size;
  }

  return bufferChunks;
};
