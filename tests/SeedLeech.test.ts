import { Client } from '../src/Client';
import { DiskFile } from '../src/models/DiskFile';
import { SupportedHashAlgorithms } from '../src/models/SupportedHashAlgorithms';

describe('Seeder/Leecher Client Integration Tests', () => {
  let seederClient: Client;
  let leecherClient: Client;
  beforeAll(async () => {
    await Client.registerDependencies();
    seederClient = new Client();
    leecherClient = new Client();
  });

  test('Leecher downloads all valid pieces from torrent', async (done) => {
    try {
      // Arrange
      const file: DiskFile = {
        file: Buffer.from('I am testing a fake single file torrent'),
        path: Buffer.from('fakedata.dat')
      };

      const metainfo = await seederClient.generateMetaInfo([file], 'testtorrent', SupportedHashAlgorithms.sha256);
      const seedTorrent = seederClient.addTorrentByMetainfo(metainfo, undefined, [file]);

      const leechTorrent = await leecherClient.addTorrentByInfoHash(metainfo.infohash);

      let pieces = 0;
      for await (const chunk of leechTorrent.downloadStream) {
        pieces++;
        expect(chunk).toBeTruthy();
      }

      expect(pieces).toEqual(metainfo.info.pieces.length);

      done();
    } catch (error) {
      done(error);
    }
  });
});
