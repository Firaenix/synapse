import { EventEmitter } from 'events';
import BittorrentDHT, { DHT } from 'bittorrent-dht';
import { ED25519SuperCopAlgorithm } from './signaturealgorithms/ED25519SuperCopAlgorithm';
import { KeyPair } from './interfaces/ISigningAlgorithm';

export class DHTService extends EventEmitter {
  private readonly dht: DHT;

  constructor(private readonly ed25519algo: ED25519SuperCopAlgorithm) {
    super();
    this.dht = new BittorrentDHT({
      verify: (sig, msg, pubkey) => {
        return this.ed25519algo.verify(msg, sig, pubkey);
      }
    });
  }

  public get = (key: Buffer) =>
    new Promise<{ signature: Buffer; value: Buffer }>((res, reject) => {
      this.dht.get(key, undefined, (err: Error, data) => {
        if (err) {
          return reject(err);
        }

        if (!data) {
          throw new Error('No data returned, check your signing algorithm');
        }

        console.log('GET', data);
        return res({ signature: data.sig, value: data.v });
      });
    });

  public subscribe = (key: Buffer, interval: number, cb: (data) => void) => {
    let previousData: { signature: Buffer; value: Buffer } | undefined = undefined;
    setInterval(async () => {
      const data = await this.get(key);
      if (previousData !== undefined && (data.signature.equals(previousData.signature) || data.value.equals(previousData.value))) {
        return;
      }

      previousData = data;
      cb(data);
    }, interval);
  };

  public publish = (keyPair: KeyPair, data: Buffer, seq: number) =>
    new Promise<Buffer>((res, reject) => {
      this.dht.put(
        {
          v: data,
          k: keyPair.publicKey,
          seq,
          sign: (buf) => {
            return this.ed25519algo.sign(buf, keyPair.secretKey, keyPair.publicKey);
          }
        },
        (err: Error, hash: Buffer) => {
          if (err) {
            return reject(err);
          }

          console.log(err, hash);
          return res(hash);
        }
      );
    });
}
