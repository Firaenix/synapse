import Wire, { EventExtension, ExtendedHandshake, HandshakeExtensions, IExtension } from '@firaenix/bittorrent-protocol';
import bencode from 'bencode';
import { Address, Bn, PrivKey } from 'bsv';
import { inject } from 'tsyringe';
import { Forge } from 'txforge';
import { v4 as uuid } from 'uuid';

import { SECP256K1KeyPair } from '../../models/SECP256K1KeyPair';
import { SupportedHashAlgorithms } from '../../models/SupportedHashAlgorithms';
import { IHashService } from '../../services/HashService';
import { ILogger } from '../../services/interfaces/ILogger';
import { SECP256K1SignatureAlgorithm } from '../../services/signaturealgorithms/SECP256K1SignatureAlgorithm';

interface BitcoinExtensionEvents {
  error: (error: Error) => void;
  TransactionRecieved: (index: number, offset: number, length: number, encodedTxn: Buffer) => void;
  [k: string]: (...args: any[]) => void;
}

enum BitcoinFlags {
  /**
   * Params: (myScriptOrder, myPubKey, Sig(InfoIdentifier), myHalfOfTx)
   */
  Handshake = 0x0,
  /**
   * If Handshake was successful
   * Params: (SHA256(Concatscript))
   */
  HandshakeACK = 0x1,
  /**
   * If Handshake script order was the same, regenerate and try again.
   * Params: (myScriptOrder, myPubKey, Sig(InfoIdentifier), myHalfOfTx)
   */
  RetryHandshake = 0x01a,
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
  tx: Forge;
  myBitcoinKey: any;
  myOrder: number | undefined;

  constructor(
    wire: Wire,
    private readonly config: BitcoinConfiguration,
    private readonly sigAlgo: SECP256K1SignatureAlgorithm,
    @inject('IHashService') private readonly hashService: IHashService,
    @inject('ILogger') private readonly logger: ILogger
  ) {
    super(wire);
    this.logger.info('Created Bitcoin extension', this.id);

    const bn = new Bn().fromBuffer(config.keyPair.secretKey);
    const bsvPrivKey = PrivKey.fromObject({ bn, compressed: true });
    bsvPrivKey.validate();
    this.myBitcoinKey = bsvPrivKey;
    console.log(bn.toString());

    const utxo = {
      txid: '6ecfee7beeb4fd2dfc6210d65e3f83caa8e046801295ab7fd29c6213d4cad9eb', // UTXO transaction id
      vout: 0, // UTXO output index (also accepts `outputIndex` or `txOutNum`)
      satoshis: 11760, // UTXO amount (also accepts `amount`)
      script: '76a91427261e18f8fab4209d14513e160ad164797b340788ac' // Hex-encoded UTXO script
    };

    const address = new Address().fromPrivKey(bsvPrivKey);
    console.log(address.toString());

    // Create initial TX
    console.log('Test', address.toString());

    // The initial TX is a tx where we send no sats to either party, they both send back to themselves, funded with a UTXO.
    // Construct your part, during the handshake, you will broadcast to eachother, hash the entire TX and verify that you each have it

    // DUP HASH160 SeederPubKeyHash EQUALVERIFY CHECKSIGVERIFY EQUALVERIFY DUP HASH160 LeecherPubKeyHash EQUALVERIFY CHECKSIG

    this.tx = new Forge({
      inputs: [utxo],
      outputs: [{ to: address.toString(), satoshis: 546 }],
      // Set the change address
      changeTo: address.toString()
    }).build();
  }

  onHandshake = async (infoIdentifier: string, peerId: string, extensions: HandshakeExtensions) => {
    this.infoIdentifier = Buffer.from(infoIdentifier);
    const res = await this.sigAlgo.sign(this.infoIdentifier, this.config.keyPair.secretKey, this.config.keyPair.publicKey);
    this.infoIdentifierSig = res;
  };
  onExtendedHandshake = (handshake: ExtendedHandshake) => {
    // Generate random number between 0 and 256, will determine script order, if same, try again
    this.myOrder = this.generateRandom256Number();

    this.sendExtendedMessage([BitcoinFlags.Handshake, this.myOrder, this.config.keyPair.publicKey, this.infoIdentifierSig, this.tx]);
  };

  // /**
  //  * Recieved a Piece request, send a BitcoinTxn to the peer for them to sign and send back.
  //  * @param index
  //  * @param offset
  //  * @param length
  //  */
  // onRequest = async (index: number, offset: number, length: number) => {
  //   try {
  //     if (this.txRequests[index] === true) {
  //       this.logger.warn(this.wire.wireName, 'Already requested for this piece');
  //       return;
  //     }

  //     const priceForPiece = this.config.getPrice(index, offset, length);

  //     this.logger.info(this.wire.wireName, `BITCOIN ${this.id} ${this.wire.wireName}: Got request for piece`, index, offset, length);

  //     this.sendExtendedMessage([BitcoinFlags.TransactionRequest, index, offset, length, Buffer.from('UnsignedTX'), priceForPiece]);

  //     const tx = await this.requestTransaction(index, offset, length, priceForPiece);

  //     this.logger.info(this.wire.wireName, 'BITCOIN: TXN BACK:', tx);
  //   } catch (error) {
  //     this.logger.error(error);
  //     throw error;
  //   }
  // };

  // private requestTransaction = (index: number, offset: number, length: number, price: number): Promise<Buffer> =>
  //   new Promise((resolve, reject) => {
  //     // If request takes longer than 30seconds, fail the request and dont send the data
  //     const t = setTimeout(() => {
  //       if (Buffer.isBuffer(this.pieceTxMap[index]) && this.pieceTxMap[index].length > 0) {
  //         return;
  //       }

  //       reject(new Error(`${this.wire.wireName} ${index}-${offset}-${length} Request for transaction timed out`));
  //     }, 30000);

  //     this.logger.info('Requesting payment for piece', index, offset, length, 'Price:', price);

  //     this.removeAllListeners(`TransactionRecieved-${index}-${offset}-${length}`);
  //     this.removeAllListeners(`TransactionRejected-${index}-${offset}-${length}`);

  //     this.sendExtendedMessage([BitcoinFlags.TransactionRequest, index, offset, length, Buffer.from('UnsignedTX'), price]);
  //     this.txRequests[index] = true;

  //     this.once(`TransactionRecieved-${index}-${offset}-${length}`, (encodedTx: Buffer) => {
  //       clearTimeout(t);
  //       resolve(encodedTx);
  //     });

  //     this.once(`TransactionRejected-${index}-${offset}-${length}`, () => {
  //       clearTimeout(t);
  //       reject(new Error('Peer rejected TransactionRequest'));
  //     });
  //   });

  onMessage = async (buf: Buffer) => {
    const [flag, ...msg]: [BitcoinFlags, ...unknown[]] = bencode.decode(buf);

    switch (flag) {
      case BitcoinFlags.Handshake:
        await this.onKeyPairHandshake(msg[0] as number, msg[1] as Buffer, msg[2] as Buffer, msg[3] as Forge);
        return;
      case BitcoinFlags.RetryHandshake:
        await this.onKeyPairHandshake(msg[0] as number, msg[1] as Buffer, msg[2] as Buffer, msg[3] as Forge);
        return;
      case BitcoinFlags.HandshakeACK:
        this.logger.info(`BITCOIN ${this.id}: Peer acknowledged valid handshake hashedtx: `, msg[0]);
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

  onKeyPairHandshake = async (peerOrder: number, publicKey: Buffer, signature: Buffer, peerHalfOfTx: Forge) => {
    this.logger.warn('GOT HANDSHAKE', peerOrder, publicKey, signature, peerHalfOfTx);

    if (!this.infoIdentifier) {
      throw new Error('Cannot verify signature without infoIdentifier');
    }

    const isValid = await this.sigAlgo.verify(this.infoIdentifier, signature, publicKey);
    if (isValid === false) {
      const err = new Error('Signature is not valid for this private key');
      this.emit('error', err);

      throw err;
    }

    if (peerOrder === this.myOrder) {
      const newRandom = this.generateRandom256Number();
      this.logger.warn('Had the same order as the peer, rehandshaking', 'old', this.myOrder, 'new', newRandom);

      this.myOrder = newRandom;
      return this.sendExtendedMessage([BitcoinFlags.Handshake, this.myOrder, this.config.keyPair.publicKey, this.infoIdentifierSig, this.tx]);
    }

    this.tx = this.tx.addInput(peerHalfOfTx.inputs[0]);
    this.tx = this.tx.addOutput(peerHalfOfTx.outputs[0]);

    const signed = this.tx.sign({ keyPair: this.config.keyPair });

    const concatTx = this.tx.build();
    const hashedTx = this.hashService.hash(Buffer.from(concatTx), SupportedHashAlgorithms.sha256);

    return this.sendExtendedMessage([BitcoinFlags.HandshakeACK, hashedTx]);
  };

  async onTransactionRequestRecieved(index: number, offset: number, length: number, unsignedTransaction: Buffer, price: number) {
    this.logger.info('Someone asked for a transaction', index, offset, length, unsignedTransaction.toString(), price);
    const signature = await this.sigAlgo.sign(unsignedTransaction, this.config.keyPair.secretKey, this.config.keyPair.publicKey);

    if (price > 100) {
      return this.sendExtendedMessage([BitcoinFlags.TransactionRejected]);
    }

    return this.sendExtendedMessage([BitcoinFlags.TransactionResponse, index, offset, length, bencode.encode({ txn: unsignedTransaction, sig: signature })]);
  }

  private generateRandom256Number = () => {
    return Math.floor(Math.random() * 256);
  };
}
