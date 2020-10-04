import '../../typings/bittorrent-dht';

import DHT from 'bittorrent-dht';
import { inject, injectable } from 'tsyringe';

import { IHashService } from '../../lib/src/services/HashService';
import { ILogger } from './interfaces/ILogger';
import { KeyPair } from './interfaces/ISigningAlgorithm';
import { ED25519SuperCopAlgorithm } from './signaturealgorithms/ED25519SuperCopAlgorithm';

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

      this.dht.listen(() => {
        // this.dht.addNode({ host: '127.0.0.1', port: this.dht.address().port });
        // dht.once('node', ready)
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   *
   * @param key SHA1KeyBuffer
   */
  public get = (key: Buffer) =>
    new Promise<{ signature: Buffer; value: Buffer }>((res, reject) => {
      this.dht.get(key, undefined, (err: Error, data) => {
        if (err) {
          return reject(err);
        }

        if (!data) {
          return reject(new Error('No data returned'));
        }

        this.logger.log('GET', data);
        return res({ signature: data.sig!, value: data.v });
      });
    });

  public subscribe = (key: Buffer, interval: number, cb: (data) => void) => {
    let previousData: { signature: Buffer; value: Buffer } | undefined = undefined;
    setInterval(async () => {
      try {
        const data = await this.get(key);
        if (previousData !== undefined && (data.signature.equals(previousData.signature) || data.value.equals(previousData.value))) {
          return;
        }

        previousData = data;
        cb(data);
      } catch (error) {
        this.logger.error('Got error back from get', error);
      }
    }, interval);
  };

  public publish = (keyPair: KeyPair, data: Buffer, salt: Buffer | undefined, seq: number) =>
    new Promise<Buffer>((res, reject) => {
      try {
        const dataBuf = Buffer.from(
          JSON.stringify({
            id: data
          })
        );

        console.log('Data:', dataBuf.toString('hex').substr(0, 16));
        // V must be less than 1000 bytes.
        this.dht.put(
          {
            v: dataBuf,
            k: keyPair.publicKey,
            seq,
            sign: (buf: Buffer) => {
              console.log('Sign Data:', buf.toString('hex').substr(0, 16));
              const signedData = this.ed25519algo.signSync(buf, keyPair.secretKey, keyPair.publicKey);
              return signedData;
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
}
