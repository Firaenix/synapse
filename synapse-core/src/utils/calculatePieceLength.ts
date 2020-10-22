/**
 * From https://github.com/michaelrhodes/piece-length
 * @param {number} bytes
 */
export const calculatePieceLength = (bytes: number) => {
  return Math.max(16384, (1 << (Math.log2(bytes < 1024 ? 1 : bytes / 1024) + 0.5)) | 0);
};
