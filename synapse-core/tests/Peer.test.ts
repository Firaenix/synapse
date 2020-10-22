import Wire from '@firaenix/bittorrent-protocol';
import BitField from 'bitfield';
import { instance, mock } from 'ts-mockito';

import { SupportedHashAlgorithms } from '../src/models/SupportedHashAlgorithms';
import { HashService } from '../src/services/HashService';
import { ILogger } from '../src/services/interfaces/ILogger';
import { Peer, PeerEvents } from '../src/services/Peer';
import { calculatePieceLength } from '../src/utils/calculatePieceLength';
import { chunkBuffer } from '../src/utils/chunkBuffer';

const mockLogger = instance(mock<ILogger>());
const hashService = new HashService();

describe('Peer tests', () => {
  const infoBuf = Buffer.from('test');

  test('sends bitfield', async (done) => {
    const wire1 = new Wire();
    const wire2 = new Wire();
    wire1.pipe(wire2).pipe(wire1);

    const peerId = hashService.hash(Buffer.from('wire1'), SupportedHashAlgorithms.sha1);
    const peerId2 = hashService.hash(Buffer.from('wire2'), SupportedHashAlgorithms.sha1);

    const bf = new BitField(2);
    bf.set(1);
    const peer1 = new Peer(wire1, infoBuf, peerId, mockLogger);
    const peer2 = new Peer(wire2, infoBuf, peerId2, mockLogger);

    // Peer 2 requested that they need the bitfield, send it to them
    peer1.on(PeerEvents.need_bitfield, (cb) => {
      cb(bf);
    });

    peer2.on(PeerEvents.got_bitfield, (bitfield) => {
      expect(Buffer.from(bitfield.buffer)).toEqual(Buffer.from(bf.buffer));
      peer2.destroy();
      peer1.destroy();
      done();
    });
  });

  test('gracefully exits during data transfer', async (done) => {
    // Arrange
    const wire1 = new Wire();
    const wire2 = new Wire();
    wire1.pipe(wire2).pipe(wire1);
    const dataBuf = Buffer.from('OH no all this data');

    const peerId = hashService.hash(Buffer.from('wire1'), SupportedHashAlgorithms.sha1);
    const peerId2 = hashService.hash(Buffer.from('wire2'), SupportedHashAlgorithms.sha1);

    const pieceLength = calculatePieceLength(dataBuf.length);
    const bufChunk = chunkBuffer(dataBuf, pieceLength);

    // Act
    const bf = new BitField(pieceLength);

    for (let index = 0; index < pieceLength; index++) {
      bf.set(index);
    }

    const peer1 = new Peer(wire1, infoBuf, peerId, mockLogger);
    const peer2 = new Peer(wire2, infoBuf, peerId2, mockLogger);

    peer2.on(PeerEvents.got_piece, (index, offset, buf) => {
      expect(buf).toEqual(bufChunk[index]);
      console.log('Peer 2 got piece', index);
    });

    peer1.on(PeerEvents.got_request, (index, offset, length) => {
      console.log('Peer 1 got req');
      peer1.sendPiece(index, offset, bufChunk[index]);
    });

    peer2.on(PeerEvents.got_request, () => {
      console.log('Peer 2 got req');
    });

    peer2.on(PeerEvents.got_bitfield, async (bitfield) => {
      try {
        console.log('Peer 2 got bitfield');

        const buf = await peer2.request(0, 0, bufChunk[0].length);
        console.log('Peer 2 Request resolved');

        expect(buf).toEqual(bufChunk[0]);

        peer1.destroy();
        peer2.destroy();
        done();
      } catch (error) {
        console.log('Peer 2 error', error);
        done(error);
      }
    });

    // peer1.on(PeerEvents.got_bitfield, async (bitfield) => {
    //   try {
    //     console.log('Peer 1 got bitfield');

    //     await peer1.request(0, 0, pieceLength);
    //     console.log('Peer 1 Request resolved');
    //   } catch (error) {
    //     console.log('Peer 1 error', error);
    //     done(error);
    //   }
    // });

    peer1.on(PeerEvents.need_bitfield, (cb) => {
      cb(bf);
    });

    peer2.on(PeerEvents.need_bitfield, (cb) => {
      cb(bf);
    });
  }, 6700);
});
