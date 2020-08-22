import Wire, { EventExtension, ExtendedHandshake, HandshakeExtensions, IExtension } from '@firaenix/bittorrent-protocol';
import bencode from 'bencode';
import { inject } from 'tsyringe';
import { v4 as uuid } from 'uuid';

import { SECP256K1KeyPair } from '../models/SECP256K1KeyPair';
import { ILogger } from '../services/interfaces/ILogger';
import { SECP256K1SignatureAlgorithm } from '../services/signaturealgorithms/SECP256K1SignatureAlgorithm';

interface BitcoinExtensionEvents {
  error: (error: Error) => void;
  TransactionRecieved: (index: number, offset: number, length: number, encodedTxn: Buffer) => void;

  [value: string]: (...args: any[]) => void;
}

enum BitcoinFlags {
  Handshake = 0x99,
  HandshakeACK = 0x1,
  TransactionRequest = 0x10,
  TransactionResponse = 0x11,
  TransactionRejected = 0x12
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
      const priceForPiece = this.config.getPrice(index, offset, length);

      this.logger.info(`BITCOIN ${this.id} ${this.wire.wireName}: Got request for piece`, index, offset, length);

      const txn = await this.requestTransaction(index, offset, length, priceForPiece);

      this.logger.info(`BITCOIN ${this.id}: Peer sent us a transaction, continue.`, index, offset, length, txn);
    } catch (error) {
      this.logger.error(error);
    }
  };

  private requestTransaction = (index: number, offset: number, length: number, price: number) =>
    new Promise((resolve, reject) => {
      // If request takes longer than 30seconds, fail the request and dont send the data

      this.sendExtendedMessage([BitcoinFlags.TransactionRequest, index, offset, length, Buffer.from('THIS IS MY TRANSACTION'), price]);
      this.removeAllListeners(`TransactionRecieved-${index}-${offset}-${length}`);
      this.removeAllListeners(`TransactionRejected-${index}-${offset}-${length}`);

      this.once(`TransactionRecieved-${index}-${offset}-${length}`, (encodedTx: Buffer) => {
        resolve(encodedTx);
      });

      this.once(`TransactionRejected-${index}-${offset}-${length}`, () => {
        reject(new Error('Peer rejected TransactionRequest'));
      });

      setTimeout(() => {
        reject(new Error('Request for transaction timed out'));
      }, 30000);
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
        this.onTransactionRequestRecieved(Number(msg[0]), Number(msg[1]), Number(msg[2]), msg[3] as Buffer, Number(msg[4]));
        return;
      case BitcoinFlags.TransactionResponse:
        this.onTransactionResponse(msg);
        return;
      case BitcoinFlags.TransactionRejected:
        this.onTransactionRejected(msg);
        return;
    }
  };

  onTransactionResponse = (msg: unknown[]) => {
    const index = Number(msg[0]);
    const offset = Number(msg[1]);
    const length = Number(msg[2]);

    // Allow single callback to someone waiting for a response for that index, offset, length
    this.emit(`TransactionRecieved-${index}-${offset}-${length}`, msg[3] as Buffer);
  };

  onTransactionRejected = (msg: unknown[]) => {
    const index = Number(msg[0]);
    const offset = Number(msg[1]);
    const length = Number(msg[2]);

    // Allow single callback to someone waiting for a response for that index, offset, length
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

  onTransactionRequestRecieved(index: number, offset: number, length: number, unsignedTransaction: Buffer, price: number) {
    const signature = this.sigAlgo.sign(unsignedTransaction, this.config.keyPair.secretKey, this.config.keyPair.publicKey);

    if (price > 100) {
      return this.sendExtendedMessage([BitcoinFlags.TransactionRejected]);
    }

    return this.sendExtendedMessage([BitcoinFlags.TransactionResponse, index, offset, length, bencode.encode({ txn: unsignedTransaction, sig: signature })]);
  }
}
