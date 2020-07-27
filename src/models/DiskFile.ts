export interface DiskFile {
  file: Buffer;
  path: Buffer;
}

export interface MetaFileInfo {
  length: number;
  path: Buffer;
}

export type DownloadedFile = MetaFileInfo & DiskFile;
