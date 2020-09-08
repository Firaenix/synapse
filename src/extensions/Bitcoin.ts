import Wire, { EventExtension, ExtendedHandshake, HandshakeExtensions, IExtension } from '@firaenix/bittorrent-protocol';
import bencode from 'bencode';
import { inject } from 'tsyringe';
import { v4 as uuid } from 'uuid';

import { SECP256K1KeyPair } from '../models/SECP256K1KeyPair';
import { ILogger } from '../services/interfaces/ILogger';
import { SECP256K1SignatureAlgorithm } from '../services/signaturealgorithms/SECP256K1SignatureAlgorithm';
import { wait } from '../utils/wait';

interface BitcoinExtensionEvents {
  error: (error: Error) => void;
  TransactionRecieved: (index: number, offset: number, length: number, encodedTxn: Buffer) => void;
  [k: string]: (...args: any[]) => void;
}

enum BitcoinFlags {
  Handshake = 0x0,
  HandshakeACK = 0x1,
  TransactionRequest = 0xa0,
  TransactionResponse = 0xa1,
  TransactionRejected = 0xa2
}

export interface BitcoinConfiguration {
  /**
   * Get price for piece in satoshis
   */
  getPrice: (index: number, offset: number, length: number) => number;
  keyPair: SECP256K1KeyPair;
}

export class BitcoinExtension extends EventExtension<BitcoinExtensionEvents> implements IExtension {
  name = 'bitcoin';
  requirePeer?: boolean | undefined;

  private peerPublicKey: Buffer | undefined;
  private infoIdentifierSig: Buffer | undefined;
  private infoIdentifier: Buffer | undefined;
  private id = uuid();

  private pieceTxMap: { [index: number]: Buffer } = {};
  private txRequests: { [index: number]: boolean } = {};

  constructor(wire: Wire, private readonly config: BitcoinConfiguration, private readonly sigAlgo: SECP256K1SignatureAlgorithm, @inject('ILogger') private readonly logger: ILogger) {
    super(wire);
    this.logger.info('Created Bitcoin extension', this.id);
  }

  onHandshake = async (infoIdentifier: string, peerId: string, extensions: HandshakeExtensions) => {
    this.infoIdentifier = Buffer.from(infoIdentifier);
    this.infoIdentifierSig = await this.sigAlgo.sign(this.infoIdentifier, this.config.keyPair.secretKey, this.config.keyPair.publicKey);
  };
  onExtendedHandshake = (handshake: ExtendedHandshake) => {
    this.sendExtendedMessage([BitcoinFlags.Handshake, this.infoIdentifierSig, this.config.keyPair.publicKey]);
  };

  /**
   * Recieved a Piece request, send a BitcoinTxn to the peer for them to sign and send back.
   * @param index
   * @param offset
   * @param length
   */
  onRequest = async (index: number, offset: number, length: number) => {
    try {
      if (this.txRequests[index] === true) {
        this.logger.warn(this.wire.wireName, 'Already requested for this piece');
        return;
      }

      const priceForPiece = this.config.getPrice(index, offset, length);

      this.logger.info(this.wire.wireName, `BITCOIN ${this.id} ${this.wire.wireName}: Got request for piece`, index, offset, length);

      this.sendExtendedMessage([BitcoinFlags.TransactionRequest, index, offset, length, Buffer.from('UnsignedTX'), priceForPiece]);

      const tx = await this.requestTransaction(index, offset, length, priceForPiece);

      this.logger.info(this.wire.wireName, 'BITCOIN: TXN BACK:', tx);

      this.logger.info(this.wire.wireName, 'Waiting 2 sec');
      await wait(2000);
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  };

  private requestTransaction = (index: number, offset: number, length: number, price: number): Promise<Buffer> =>
    new Promise((resolve, reject) => {
      // If request takes longer than 30seconds, fail the request and dont send the data
      const t = setTimeout(() => {
        if (Buffer.isBuffer(this.pieceTxMap[index]) && this.pieceTxMap[index].length > 0) {
          return;
        }

        reject(new Error(`${this.wire.wireName} ${index}-${offset}-${length} Request for transaction timed out`));
      }, 30000);

      this.logger.info('Requesting payment for piece', index, offset, length, 'Price:', price);

      this.removeAllListeners(`TransactionRecieved-${index}-${offset}-${length}`);
      this.removeAllListeners(`TransactionRejected-${index}-${offset}-${length}`);

      this.sendExtendedMessage([BitcoinFlags.TransactionRequest, index, offset, length, Buffer.from('UnsignedTX'), price]);
      this.txRequests[index] = true;

      this.once(`TransactionRecieved-${index}-${offset}-${length}`, (encodedTx: Buffer) => {
        clearTimeout(t);
        resolve(encodedTx);
      });

      this.once(`TransactionRejected-${index}-${offset}-${length}`, () => {
        clearTimeout(t);
        reject(new Error('Peer rejected TransactionRequest'));
      });
    });

  onMessage = async (buf: Buffer) => {
    const [flag, ...msg]: [BitcoinFlags, ...unknown[]] = bencode.decode(buf);

    switch (flag) {
      case BitcoinFlags.Handshake:
        await this.onKeyPairHandshake(msg[0] as Buffer, msg[1] as Buffer);
        return;
      case BitcoinFlags.HandshakeACK:
        this.logger.info(`BITCOIN ${this.id}: Peer acknowledged valid handshake`);
        return;
      case BitcoinFlags.TransactionRequest:
        await this.onTransactionRequestRecieved(Number(msg[0]), Number(msg[1]), Number(msg[2]), msg[3] as Buffer, Number(msg[4]));
        return;
      case BitcoinFlags.TransactionResponse:
        this.onTransactionResponse(msg);
        return;
      case BitcoinFlags.TransactionRejected:
        this.onTransactionRejected(msg);
        return;
      default:
        this.logger.warn('Peer sent unknown message:', Buffer.from(flag).toString(), msg);
        return;
    }
  };

  onTransactionResponse = (msg: unknown[]) => {
    const index = Number(msg[0]);
    const offset = Number(msg[1]);
    const length = Number(msg[2]);
    const TxBuf = bencode.decode(msg[3] as Buffer);

    this.logger.warn('onTransactionResponse', index, offset, length, TxBuf);

    // Allow single callback to someone waiting for a response for that index, offset, length
    this.pieceTxMap[index] = msg[3] as Buffer;
    this.logger.warn(`TransactionRecieved-${index}-${offset}-${length}`, msg[3] as Buffer);
    this.emit(`TransactionRecieved-${index}-${offset}-${length}`, msg[3]);
  };

  onTransactionRejected = (msg: unknown[]) => {
    const index = Number(msg[0]);
    const offset = Number(msg[1]);
    const length = Number(msg[2]);

    // Allow single callback to someone waiting for a response for that index, offset, length
    this.logger.warn(`TransactionRejected-${index}-${offset}-${length}`);
    this.emit(`TransactionRejected-${index}-${offset}-${length}`);
  };

  onKeyPairHandshake = async (signature: Buffer, publicKey: Buffer) => {
    if (!this.infoIdentifier) {
      throw new Error('Cannot verify signature without infoIdentifier');
    }

    const isValid = await this.sigAlgo.verify(this.infoIdentifier, signature, publicKey);
    if (isValid === false) {
      const err = new Error('Signature is not valid for this private key');
      this.emit('error', err);

      throw err;
    }

    this.peerPublicKey = publicKey;
    return this.sendExtendedMessage([BitcoinFlags.HandshakeACK]);
  };

  async onTransactionRequestRecieved(index: number, offset: number, length: number, unsignedTransaction: Buffer, price: number) {
    this.logger.info('Someone asked for a transaction', index, offset, length, unsignedTransaction.toString(), price);
    const signature = await this.sigAlgo.sign(unsignedTransaction, this.config.keyPair.secretKey, this.config.keyPair.publicKey);

    if (price > 100) {
      return this.sendExtendedMessage([BitcoinFlags.TransactionRejected]);
    }

    return this.sendExtendedMessage([BitcoinFlags.TransactionResponse, index, offset, length, bencode.encode({ txn: unsignedTransaction, sig: signature })]);
  }
}
