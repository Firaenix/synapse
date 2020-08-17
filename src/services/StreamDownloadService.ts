import fs from 'fs';
import path from 'path';

import { DownloadedFile } from '../models/DiskFile';
import { ILogger } from './interfaces/ILogger';
import { TorrentManager } from './TorrentManager';

export class StreamDownloadService {
  constructor(private readonly logger: ILogger) {}

  public download = (torrent: TorrentManager, downloadPath: string) => {
    const metainfoFile = torrent.metainfo;
    const readStream = torrent.downloadStream;
    const bufs: Array<Buffer> = [];

    readStream.on('data', (chunk: Buffer) => {
      const [index, offset] = chunk.toString().split(':');
      this.logger.log('index, offset', index, offset);
      bufs.splice(Number(index), 0, chunk.slice(Buffer.from(index).length + Buffer.from(':').length + Buffer.from(offset).length + Buffer.from(':').length));
    });

    readStream.on('end', async () => {
      const fullFiles = Buffer.concat(bufs);
      const downloadedFiles: Array<DownloadedFile> = [];

      if (!metainfoFile) {
        throw new Error('Cant end Torrent download without metainfo to validate');
      }

      let nextOffset = 0;
      // Split fullFiles into separate buffers based on the length of each file
      for (const file of metainfoFile.info.files) {
        this.logger.log('Splitting file', file.path.toString(), file.length);

        this.logger.log('Reading from offset', nextOffset, 'to', file.length);

        const fileBytes = fullFiles.subarray(nextOffset, file.length + nextOffset);
        this.logger.log('Split file:', fileBytes.length);

        if (fileBytes.length !== file.length) {
          throw new Error('Buffer isnt the same length as the file');
        }

        downloadedFiles.push({
          file: fileBytes,
          ...file
        });

        nextOffset = nextOffset + file.length;
      }

      for (const file of downloadedFiles) {
        const filePath = path.resolve(downloadPath, metainfoFile.info.name.toString(), file.path.toString());
        this.logger.log('Saving to ', filePath);
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
        // Create folders if necessary
        await fs.promises.writeFile(filePath, file.file);
      }
    });
  };
}
