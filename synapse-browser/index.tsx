import 'reflect-metadata';
import 'regenerator-runtime/runtime';

import bencode from 'bencode';
import { readFileSync } from 'fs';
import synapse from 'synapse-core/lib/Client.min.js';

// const raw = readFileSync(__dirname + '/raw.tsx', 'utf-8');


console.log(synapse)
const client = new synapse.Client();

const mymetainfo = readFileSync("./mymetainfo_1.ben");

console.log("mymetainfo", mymetainfo, Buffer.from(mymetainfo), Buffer.from(mymetainfo)[283]);
const thing = Buffer.from(mymetainfo)
const info = bencode.decode(thing);

console.log("info", info);
client.addTorrentByInfoSig(Buffer.from(info.infosig))