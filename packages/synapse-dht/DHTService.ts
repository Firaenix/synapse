import './bittorrent-dht';

import { ILogger } from '@firaenix/synapse-core/lib/interfaces/ILogger';
import { IHashService } from '@firaenix/synapse-core/lib/services/HashService';
import { KeyPair } from '@firaenix/synapse-core/lib/services/interfaces/';
import DHT, { DHTGetCallbackRes } from 'bittorrent-dht';
import { inject, injectable } from 'tsyringe';

import { ED25519SuperCopAlgorithm } from './ED25519SuperCopAlgorithm';

@injectable()
export class DHTService {
  private readonly dht: DHT;

  constructor(private readonly ed25519algo: ED25519SuperCopAlgorithm, @inject('IHashService') private readonly hashService: IHashService, @inject('ILogger') private readonly logger: ILogger) {
    try {
      this.dht = new DHT({
        host: true,
        verify: (sig, msg, pubkey) => this.ed25519algo.verifySync(msg, sig, pubkey)
        // hash: (buf) => this.hashService.hash(buf, SupportedHashAlgorithms.sha256)
      });

      this.dht.listen(() => {});
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   *
   * @param {Buffer} key Hash of Public Key
   */
  public get = (key: Buffer) =>
    new Promise<DHTGetCallbackRes>((res, reject) => {
      this.dht.get(key, undefined, (err: Error, data) => {
        if (err) {
          return reject(err);
        }

        if (!data) {
          return reject(new Error('No data returned'));
        }

        return res(data);
      });
    });

  public subscribe = (key: Buffer, interval: number, cb: (data: DHTGetCallbackRes, cancel: () => void) => void) => {
    let previousData: DHTGetCallbackRes | undefined = undefined;
    const currentInterval = setInterval(async () => {
      try {
        const data = await this.get(key);
        if (previousData !== undefined && (data.sig!.equals(previousData.sig!) || data.v.equals(previousData.v))) {
          return;
        }

        previousData = data;
        cb(data, () => {
          clearInterval(currentInterval);
        });
      } catch (error) {
        this.logger.warn('Got error back from get', error);
      }
    }, interval);
  };

  public publish = (keyPair: KeyPair, data: Buffer, salt: Buffer | undefined, seq: number) =>
    new Promise<Buffer>((res, reject) => {
      try {
        const dataBuf = Buffer.from(data);

        this.dht.put(
          {
            v: dataBuf,
            k: keyPair.publicKey,
            seq,
            sign: (buf: Buffer) => {
              const signed = this.ed25519algo.signSync(buf, keyPair.secretKey, keyPair.publicKey);
              return signed;
            },
            salt
          },
          (err: Error, hash: Buffer) => {
            if (err) {
              return reject(err);
            }

            return res(hash);
          }
        );
      } catch (error) {
        this.logger.error(error);
        reject(error);
      }
    });

  public destroy = () =>
    new Promise((res) => {
      this.dht.destroy(res);
    });
}
