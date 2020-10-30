import Wire, { IExtension } from '@firaenix/bittorrent-protocol';

import { MetainfoFile } from './MetainfoFile';

export type InjectedExtension = (wire: Wire, infoId: Buffer, metainfo?: MetainfoFile) => IExtension;
