import fs from 'fs';
import path from 'path';

export const CreateFilesFromPaths = (paths: string[]) => {
  return paths.sort().map((p) => {
    const filePath = path.relative('.', p);

    const fileBuf = fs.readFileSync(filePath);

    return {
      file: fileBuf,
      path: Buffer.from(filePath)
    };
  });
};
