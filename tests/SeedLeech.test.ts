import { Client } from '../src/Client';
import { DiskFile } from '../src/models/DiskFile';
import { SupportedHashAlgorithms } from '../src/models/SupportedHashAlgorithms';

describe('Seeder/Leecher Client Integration Tests', () => {
  test('Leecher downloads all valid pieces from torrent', async (done) => {
    await Client.registerDependencies();
    const seederClient = new Client();
    const leecherClient = new Client();
    try {
      // Arrange
      const file: DiskFile = {
        file: Buffer.from('I am testing a fake single file torrent'),
        path: Buffer.from('fakedata.dat')
      };

      const metainfo = await seederClient.generateMetaInfo([file], 'testtorrent', SupportedHashAlgorithms.sha256);
      const seedTorrent = await seederClient.addTorrentByMetainfo(metainfo, undefined, [file]);
      const leechTorrent = await leecherClient.addTorrentByInfoHash(metainfo.infohash);

      let pieces = 0;
      for await (const chunk of leechTorrent.downloadStream) {
        pieces++;
        expect(chunk).toBeTruthy();
      }

      expect(pieces).toEqual(metainfo.info.pieces.length);

      await seederClient.stopAllTorrents();
      await leecherClient.stopAllTorrents();
      done();
    } catch (error) {
      console.error(error);
      await seederClient.stopAllTorrents();
      await leecherClient.stopAllTorrents();
      done(error);
    }
  }, 10000);
});
