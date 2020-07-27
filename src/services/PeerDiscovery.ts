import { MetainfoFile } from '../models/MetainfoFile';
import { Peer } from './Peer';
import Wire from '@firaenix/bittorrent-protocol';
import Bitfield from 'bitfield';
import { HashService } from './HashService';
import SimplePeer from 'simple-peer';
import wrtc from 'wrtc';
import net from 'net';
import crypto from 'crypto';
import hyperswarm from 'hyperswarm';
import { SupportedHashAlgorithms } from '../models/SupportedHashAlgorithms';

export class PeerManager {
  constructor(
    private hashService: HashService,
    private metainfoFile: MetainfoFile,
    private infoHash: Buffer,
    private bitfield: Bitfield,
    private fileChunks: Array<Buffer> | undefined,
    private onPeerFoundCallback: (peer: Peer) => void,
    private onPieceValidated: () => void
  ) {
    const swarm = hyperswarm();

    swarm.join(infoHash, {
      lookup: true, // find & connect to peers
      announce: true // optional- announce self as a connection target
    });

    swarm.on('connection', (socket, details) => {
      console.log('Connection details', details);
      const wire = new Wire('seed');
      // you can now use the socket as a stream, eg:
      // process.stdin.pipe(socket).pipe(process.stdout)
      wire.pipe(socket).pipe(wire);

      const peer = new Peer(wire, metainfoFile, infoHash.toString('hex'), bitfield, fileChunks, hashService);
      // console.log('Connected to socket!');
    });
  }
}
