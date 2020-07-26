import { promises as fs } from 'fs';
import path from 'path';

export default async function recursiveReadDir(directory: string) {
  let fileList: string[] = [];

  const files = await fs.readdir(directory);
  for (const file of files) {
    const p = path.join(directory, file);
    if ((await fs.stat(p)).isDirectory()) {
      fileList = [...fileList, ...(await recursiveReadDir(p))];
    } else {
      fileList.push(p);
    }
  }

  return fileList;
}
