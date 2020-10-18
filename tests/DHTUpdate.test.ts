import { SupportedHashAlgorithms } from '../src/models/SupportedHashAlgorithms';
import { DHTService } from '../src/services/DHTService';
import { HashService } from '../src/services/HashService';
import { ConsoleLogger } from '../src/services/LogLevelLogger';
import { ED25519SuperCopAlgorithm } from '../src/services/signaturealgorithms/ED25519SuperCopAlgorithm';
import { wait } from '../src/utils/wait';

describe('DHT Update Tests', () => {
  test('Other listeners are notified when an update is published', async (done) => {
    // Arrange Common
    const ed25519 = await ED25519SuperCopAlgorithm.build();
    const hashService = new HashService();
    const logger = new ConsoleLogger();

    // Arrange Publisher Variables
    const publisherDHTService = new DHTService(ed25519, hashService, logger);
    const publisherKeyPair = ed25519.generateKeyPairSync();
    const firstMessage = Buffer.from('Hello, DHT');
    const secondMessage = Buffer.from('Goodbye, DHT');

    const keyId = await publisherDHTService.publish(publisherKeyPair, firstMessage, undefined, 0);

    const pubKeyHash = hashService.hash(publisherKeyPair.publicKey, SupportedHashAlgorithms.sha1);
    expect(keyId).toEqual(pubKeyHash);

    // Arrange Listener Variables
    const listenerDHTService = new DHTService(ed25519, hashService, logger);

    // Act
    const message = await listenerDHTService.get(pubKeyHash);

    // Assert
    expect(message.v.toString('utf-8')).toEqual(firstMessage.toString('utf-8'));

    const keyID2 = await publisherDHTService.publish(publisherKeyPair, secondMessage, undefined, 1);

    // Should output the same hashId (pubkeyhash)
    expect(keyID2).toEqual(keyId);

    const message2 = await listenerDHTService.get(pubKeyHash);

    expect(message2.v.toString('utf-8')).toEqual(secondMessage.toString('utf-8'));

    await publisherDHTService.destroy();
    await listenerDHTService.destroy();
    done();
  }, 100000);

  test('Publish loop 5 times recieved with subscribe', async (done) => {
    // Arrange Common
    const ed25519 = await ED25519SuperCopAlgorithm.build();
    const hashService = new HashService();
    const logger = new ConsoleLogger();

    // Arrange Publisher Variables
    const publisherDHTService = new DHTService(ed25519, hashService, logger);
    const publisherKeyPair = ed25519.generateKeyPairSync();

    // Arrange Listener Variables
    const listenerDHTService = new DHTService(ed25519, hashService, logger);

    const values = ['Hello', '42', '3', 'End', 'OneMoreTime', 'Last One'];

    // Act
    const pubKeyHash = hashService.hash(publisherKeyPair.publicKey, SupportedHashAlgorithms.sha1);
    listenerDHTService.subscribe(pubKeyHash, 1000, async (data, cancel) => {
      const expected = values[data.seq!];

      console.log('got data from subscription', data);
      expect(data.v.toString('utf-8')).toEqual(expected);

      if (data.seq! >= 5) {
        await publisherDHTService.destroy();
        await listenerDHTService.destroy();
        cancel();
        done();
      }
    });

    let seq = -1;
    for (const value of values) {
      await publisherDHTService.publish(publisherKeyPair, Buffer.from(value), undefined, seq + 1);

      const gotValue = await publisherDHTService.get(pubKeyHash);
      seq = gotValue.seq!;

      await wait(2000);
    }
  }, 100000);
});
