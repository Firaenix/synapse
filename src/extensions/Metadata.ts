import Wire, { EventExtension, ExtendedHandshake, HandshakeExtensions } from '@firaenix/bittorrent-protocol';
import bencode from 'bencode';
import Bitfield from 'bitfield';
import { inject } from 'tsyringe';

import { isSignedMetainfo, MetainfoFile, SignedMetainfoFile } from '../models/MetainfoFile';
import { IHashService } from '../services/HashService';
import { ILogger } from '../services/interfaces/ILogger';
import { SupportedSignatureAlgorithms } from '../services/interfaces/ISigningAlgorithm';
import { ISigningService } from '../services/interfaces/ISigningService';
import { MetaInfoService } from '../services/MetaInfoService';
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
  public myBitfield: Bitfield;
  public metaPieceLength: number;
  public peerBitfield?: Bitfield;

  private _metadataBuffer?: Buffer;

  private reconstructedBuffer?: Buffer;
  private metaPieceCount: number;

  constructor(
    public readonly wire: Wire,
    private readonly infoIdentifier: Buffer,
    private metainfoService: MetaInfoService,
    @inject('IHashService') private readonly hashService: IHashService,
    @inject('ISigningService') private readonly signingService: ISigningService,
    @inject('ILogger') private readonly logger: ILogger
  ) {
    super(wire);

    this.logger.info('Created MetadataExtension', wire.wireName);

    const metaBuffer = bencode.encode(this.metainfoService.metainfo);
    this.metaPieceLength = calculatePieceLength(metaBuffer.length);
    const bufferChunks = chunkBuffer(metaBuffer, this.metaPieceLength);
    this.metaPieceCount = bufferChunks.length;

    this.myBitfield = new Bitfield(this.metaPieceCount);
    for (let index = 0; index < this.metaPieceCount; index++) {
      this.myBitfield.set(index);
    }
  }

  private get metadataBuffer(): Buffer | undefined {
    if (!this.metainfoService.metainfo) {
      return undefined;
    }

    if (this._metadataBuffer) {
      return this._metadataBuffer;
    }

    this._metadataBuffer = bencode.encode(this.metainfoService.metainfo);
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

    const hasDataFlag = Number(this.metainfoService.metainfo === undefined ? 0x0 : 0x1);

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

    this.logger.log('Recieved metadata piece', index, pieceBuf, this.peerBitfield?.buffer.byteLength);
    // this.logger.log('GOT METAINFO!');
    // const metainfo = bencode.decode(metainfoBuffer);
    // this.metainfoService.metainfo = metainfo;
    // this.logger.log('Recieved metainfo:', metainfo.infohash, metainfo.info['piece length']);

    if (!this.peerBitfield) {
      throw new Error('Shits fucked');
    }

    if (!this.reconstructedBuffer) {
      this.reconstructedBuffer = Buffer.alloc(this.metaPieceCount * this.metaPieceLength);
    }

    pieceBuf.copy(this.reconstructedBuffer, index * this.metaPieceLength);
    this.myBitfield.set(index);

    if (index === this.metaPieceCount - 1) {
      this.logger.log('GOT ALL PIECES! YAY LETS CHECK VALIDITY');
      const metainfo: MetainfoFile = bencode.decode(this.reconstructedBuffer);

      await this.isValidMetainfo(metainfo);
      this.metainfoService.metainfo = metainfo;
      this.sendExtendedMessage([MetainfoFlags.recieved_metainfo]);
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

  private isValidMetainfo = async (metainfo: MetainfoFile): Promise<boolean> => {
    if (metainfo.infohash.equals(Buffer.from(this.infoIdentifier))) {
      this.logger.log('YAY! it was an info hash and it matches, now to calculate infohash and see if still matches');
      if (this.isValidInfoHash(metainfo, this.infoIdentifier) === false) {
        throw new Error('Something is fucked with the metainfo we recieved');
      }

      return true;
    }

    if (isSignedMetainfo(metainfo) && metainfo.infosig.equals(Buffer.from(this.infoIdentifier))) {
      this.logger.log('YAY! it was an info sig and it matches, now to calculate info hash and compare with infosig to see if its a valid signature');

      const isValidSig = await this.isValidInfoSig(metainfo, this.infoIdentifier);
      if (isValidSig === false) {
        throw new Error('Something is fucked with the metainfo we recieved');
      }

      return true;
    }

    return false;
  };

  private isValidInfoHash = (metainfo: MetainfoFile, infoHash: Buffer): boolean => {
    if (metainfo.infohash.equals(Buffer.from(infoHash)) === false) {
      return false;
    }

    const infoBuf = bencode.encode(metainfo.info);
    const metainfoHashBuf = this.hashService.hash(infoBuf, metainfo.info['piece hash algo']);
    if (metainfoHashBuf.equals(Buffer.from(infoHash)) === false) {
      return false;
    }

    return true;
  };

  private isValidInfoSig = async (metainfo: SignedMetainfoFile, infoSig: Buffer): Promise<boolean> => {
    // Calculate info hash
    const infoBuf = bencode.encode(metainfo.info);
    const metainfoHashBuf = this.hashService.hash(infoBuf, metainfo.info['piece hash algo']);

    if (metainfoHashBuf.equals(Buffer.from(metainfo.infohash)) === false) {
      this.logger.warn('Calculated infohash doesnt match metainfo infohash');
      return false;
    }

    return this.signingService.verify(metainfoHashBuf, Buffer.from(infoSig), Buffer.from(metainfo['pub key']), SupportedSignatureAlgorithms[Buffer.from(metainfo['infosig algo']).toString()]);
  };
}
