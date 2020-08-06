import { EventEmitter } from 'events';
import BittorrentDHT, { DHT } from 'bittorrent-dht';
import { ED25519Algorithm } from './signaturealgorithms/ED25519Algorithm';
import { ED25519SuperCopAlgorithm } from './signaturealgorithms/ED25519SuperCopAlgorithm';
import { KeyPair } from './interfaces/ISigningAlgorithm';

export class DHTService extends EventEmitter {
  private readonly dht: DHT;
  private readonly ed25519algo: ED25519SuperCopAlgorithm;

  constructor() {
    super();
    this.ed25519algo = new ED25519SuperCopAlgorithm();

    this.dht = new BittorrentDHT({
      verify: async (signature: Buffer, value: Buffer, publicKey: Buffer) => {
        console.log(signature, value, publicKey);
        return !!(await this.ed25519algo.verify(value, signature, publicKey));
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
          console.log('No data returned?');
          return res({ signature: Buffer.alloc(0), value: Buffer.alloc(0) });
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
          sign: async (msg) => {
            const sig = await this.ed25519algo.sign(msg, keyPair.secretKey, keyPair.publicKey);
            return sig;
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
