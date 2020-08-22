import BittorrentDHT, { DHT } from 'bittorrent-dht';
import { inject } from 'tsyringe';

import { ILogger } from './interfaces/ILogger';
import { KeyPair } from './interfaces/ISigningAlgorithm';
import { ED25519SuperCopAlgorithm } from './signaturealgorithms/ED25519SuperCopAlgorithm';

export class DHTService {
  private readonly dht: DHT;

  constructor(private readonly ed25519algo: ED25519SuperCopAlgorithm, @inject('ILogger') private readonly logger: ILogger) {
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

        this.logger.log('GET', data);
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

          this.logger.log(err, hash);
          return res(hash);
        }
      );
    });
}
