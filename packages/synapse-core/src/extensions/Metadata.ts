import Wire, { EventExtension, ExtendedHandshake, HandshakeExtensions } from '@firaenix/bittorrent-protocol';
import bencode from 'bencode';
import Bitfield from 'bitfield';
import { inject } from 'tsyringe';

import { isSignedMetainfo, MetainfoFile, SignedMetainfoFile } from '../models/MetainfoFile';
import { IHashService } from '../services/HashService';
import { ILogger } from '../services/interfaces/ILogger';
import { ISigningService } from '../services/interfaces/ISigningService';
import { calculatePieceLength } from '../utils/calculatePieceLength';
import { chunkBuffer } from '../utils/chunkBuffer';

enum MetainfoFlags {
  /**
   * Recieved when peer says they have metadata for you
   */
  have_metadata = 0x0,

  /**
   * When request for amount of pieces
   * [piece_bitfield]
   */
  piece_bitfield = 0x1,

  /**
   * [bitfield, BitField, piece_count, pieceLength]
   */
  bitfield = 0x2,

  /**
   * Requesting a specific piece
   * [fetch, piece_index]
   */
  fetch = 0x3,

  /**
   * Recieved a piece
   * [piece, piece_index, bytearray]
   */
  piece = 0x4,

  /**
   * Got all pieces and verified
   * [recieved_metainfo, true]
   */
  recieved_metainfo = 0x99,

  error = 0xff
}

export interface MetadataExtensionEvents {
  ReceivedMetainfo: (metainfo: MetainfoFile) => void;
  error: (err: Error) => void;
}

export class MetadataExtension extends EventExtension<MetadataExtensionEvents> {
  public name = 'metadata';
  public requirePeer?: boolean | undefined;
  public myBitfield?: Bitfield;
  // public metaPieceLength: number;
  public peerBitfield?: Bitfield;

  private _metadataBuffer?: Buffer;

  private reconstructedBuffer?: Buffer;
  // private metaPieceCount: number;

  /**
   * If you only have an infoId, this will be undefined.
   * If you have metainfo, you are the equivalent of a seeder.
   */
  private metainfo?: MetainfoFile;
  private metaPieceLength?: number;
  private metaPieceCount?: number;

  constructor(
    public readonly wire: Wire,
    public readonly infoId: Buffer,
    metainfo: MetainfoFile | undefined,
    @inject('IHashService') private readonly hashService: IHashService,
    @inject('ISigningService') private readonly signingService: ISigningService,
    @inject('ILogger') private readonly logger: ILogger
  ) {
    super(wire);

    this.metainfo = metainfo;

    if (metainfo) {
      const metaBuffer = bencode.encode(metainfo);
      this.metaPieceLength = calculatePieceLength(metaBuffer.length);
      const bufferChunks = chunkBuffer(metaBuffer, this.metaPieceLength);
      this.metaPieceCount = bufferChunks.length;
      this._metadataBuffer = metaBuffer;

      this.myBitfield = new Bitfield(this.metaPieceCount);
      for (let index = 0; index < this.metaPieceCount; index++) {
        this.myBitfield.set(index);
      }
    }

    this.logger.info(wire.wireName, metainfo?.infohash.toString('hex'), 'Created MetadataExtension');
  }

  private get metadataBuffer(): Buffer | undefined {
    return this._metadataBuffer;
  }

  onHandshake = (infoHash: string, peerId: string, extensions: HandshakeExtensions) => {
    this.logger.log('metadata onHandshake', this.wire.wireName, infoHash, peerId, extensions);
  };

  onExtendedHandshake = (handshake: ExtendedHandshake) => {
    this.logger.log('metadata onExtendedHandshake', handshake);

    this.logger.log(handshake);
    if (handshake.exts[this.name] === undefined) {
      this.logger.warn('Remote peer has no metadata extension');
      return;
    }

    const hasDataFlag = Number(this.metainfo === undefined ? 0x0 : 0x1);

    this.sendExtendedMessage([MetainfoFlags.have_metadata, hasDataFlag]);
  };

  // onBitField = () =>
  //   new Promise<void>((resolve, reject) => {
  //     this.eventBus.on(MetadataExtensionEvents.ReceivedMetainfo, () => {
  //       this.logger.log('Metainfo recieved!');
  //       resolve();
  //     });

  //     this.eventBus.on(MetadataExtensionEvents.Error, (err) => {
  //       this.logger.error('Error getting metainfo');
  //       reject(err);
  //     });
  //   });

  onMessage = (buf: Buffer) => {
    const [flag, ...msg]: [MetainfoFlags, ...unknown[]] = bencode.decode(buf);

    this.logger.warn('Received flag', MetainfoFlags[flag], 'Message', msg, msg[1]);
    try {
      switch (flag) {
        case MetainfoFlags.have_metadata:
          return this.peerHasMetainfo(Boolean(msg[0]));

        case MetainfoFlags.piece_bitfield:
          return this.onMetadataBitfieldRequested();
        case MetainfoFlags.bitfield:
          return this.onPeerMetadataBitfield(Object(msg[0]), Number(msg[1]), Number(msg[2]));

        case MetainfoFlags.fetch:
          return this.onFetchRequested(Number(msg[0]));
        case MetainfoFlags.piece:
          return this.onRecievedPiece(Number(msg[0]), Buffer.from(msg[1] as Buffer));

        case MetainfoFlags.recieved_metainfo:
          return this.logger.warn('Peer finished getting all pieces!');

        case MetainfoFlags.error:
          return this.logger.error(msg[0]);
      }
    } catch (error) {
      this.sendExtendedMessage([MetainfoFlags.error, error]);
      this.emit('error', error);
    }
  };

  peerHasMetainfo = (hasMetaInfo: boolean) => {
    // If we have metainfo, dont do anything.
    if (this.metadataBuffer) {
      return;
    }

    // if they dont have metainfo, do nothing
    if (!hasMetaInfo) {
      return;
    }

    // If we dont have metainfo, but they do, request it.
    this.logger.log('Requesting metadata from peer');
    this.sendExtendedMessage([MetainfoFlags.piece_bitfield]);
  };

  onMetadataBitfieldRequested() {
    this.sendExtendedMessage([MetainfoFlags.bitfield, this.myBitfield, this.metaPieceCount, this.metaPieceLength]);
  }

  /**
   * Last step of the metadata handshake, sets the information we need to recieve the metainfo.
   * @param msg
   * @param pieceCount
   * @param metaPieceLength
   */
  onPeerMetadataBitfield(msg: Bitfield, pieceCount: number, metaPieceLength: number) {
    this.logger.log('onPeerMetadataBitfield msg', new Bitfield(msg.buffer, { grow: msg.grow }));

    this.peerBitfield = new Bitfield(msg.buffer, { grow: msg.grow });
    this.myBitfield = new Bitfield(pieceCount, { grow: msg.grow });
    this.metaPieceLength = metaPieceLength;
    this.metaPieceCount = pieceCount;

    // Get first bit we dont have but they do.

    this.sendExtendedMessage([MetainfoFlags.fetch, 0]);
  }

  onFetchRequested = (index: number) => {
    this.logger.log('metainfo requested from peer', index);
    if (!this.metaPieceLength) {
      throw new Error('Cannot accept a fetch request when we havent handshaken');
    }

    const chunkStart = this.metaPieceLength * index;
    this.logger.log('chunkStart', chunkStart);
    const chunkEnd = chunkStart + this.metaPieceLength;
    this.logger.log('chunkEnd', chunkEnd);

    const chunk = this.metadataBuffer?.subarray(chunkStart, chunkEnd);
    this.logger.log('chunk', chunk);

    this.sendExtendedMessage([MetainfoFlags.piece, index, chunk]);
  };

  onRecievedPiece = async (index: number, pieceBuf: Buffer) => {
    if (pieceBuf.length <= 0) {
      throw new Error('Nuhuh, dont like that');
    }

    if (!this.metaPieceLength || !this.metaPieceCount || !this.myBitfield) {
      throw new Error('Cannot accept a fetch request when we havent handshaken');
    }

    if (!this.peerBitfield) {
      throw new Error('Shits fucked');
    }

    this.logger.log('Recieved metadata piece', index, pieceBuf, this.peerBitfield?.buffer.byteLength);

    if (!this.reconstructedBuffer) {
      this.reconstructedBuffer = Buffer.alloc(this.metaPieceCount * this.metaPieceLength);
    }

    pieceBuf.copy(this.reconstructedBuffer, index * this.metaPieceLength);
    this.myBitfield.set(index);

    if (index === this.metaPieceCount - 1) {
      this.logger.log('GOT ALL PIECES! LETS CHECK VALIDITY');
      const metainfo: MetainfoFile = bencode.decode(this.reconstructedBuffer);

      await this.isValidMetainfo(metainfo);
      this.sendExtendedMessage([MetainfoFlags.recieved_metainfo]);
      this.metainfo = metainfo;
      this.emit('ReceivedMetainfo', metainfo);
      return;
    }

    let nextPieceIndex = index;
    // Keep checking for next piece index we dont have
    while (this.myBitfield.get(nextPieceIndex) === true && nextPieceIndex <= this.metaPieceCount) {
      nextPieceIndex++;
    }

    this.sendExtendedMessage([MetainfoFlags.fetch, nextPieceIndex]);
  };

  private get infoIdentifier() {
    return this.infoId;
  }

  private isValidMetainfo = async (metainfo: MetainfoFile): Promise<boolean> => {
    if (!this.infoIdentifier) {
      throw new Error('Need infoidentifier to create metadata extension');
    }

    if (metainfo.infohash.equals(Buffer.from(this.infoIdentifier))) {
      this.logger.log('METAINFO GET! it was an info hash and it matches, now to calculate infohash and see if still matches');
      const isValidInfoHash = await this.isValidInfoHash(metainfo, this.infoIdentifier);
      if (isValidInfoHash === false) {
        throw new Error('Something is fucked with the metainfo we recieved');
      }

      return true;
    }

    if (isSignedMetainfo(metainfo) && metainfo.infosig.equals(Buffer.from(this.infoIdentifier))) {
      this.logger.log('SIGNED METAINFO GET! it was an info sig and it matches, now to calculate info hash and compare with infosig to see if its a valid signature');

      const isValidSig = await this.isValidInfoSig(metainfo, this.infoIdentifier);
      if (isValidSig === false) {
        throw new Error('Something is fucked with the metainfo we recieved');
      }

      this.logger.log('Signature matches infoIdentifier, this is a valid metainfo');
      return true;
    }

    return false;
  };

  private isValidInfoHash = async (metainfo: MetainfoFile, infoHash: Buffer): Promise<boolean> => {
    if (metainfo.infohash.equals(Buffer.from(infoHash)) === false) {
      return false;
    }

    const infoBuf = bencode.encode(metainfo.info);
    const metainfoHashBuf = await this.hashService.hash(infoBuf, metainfo.info['piece hash algo']);
    if (metainfoHashBuf.equals(Buffer.from(infoHash)) === false) {
      return false;
    }

    return true;
  };

  private isValidInfoSig = async (metainfo: SignedMetainfoFile, infoSig: Buffer): Promise<boolean> => {
    // Calculate info hash
    const infoBuf = bencode.encode(metainfo.info);
    const metainfoHashBuf = await this.hashService.hash(infoBuf, metainfo.info['piece hash algo']);

    if (metainfoHashBuf.equals(Buffer.from(metainfo.infohash)) === false) {
      this.logger.warn('Calculated infohash doesnt match metainfo infohash');
      return false;
    }

    const newMetaSignAlgo = Buffer.from(metainfo['infosig algo']).toString();

    return this.signingService.verify(metainfoHashBuf, Buffer.from(infoSig), Buffer.from(metainfo['pub key']), newMetaSignAlgo);
  };
}
