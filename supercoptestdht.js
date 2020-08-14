// const ed = require('bittorrent-dht-sodium');
const ed = require('ed25519-supercop');
const seed = ed.createSeed();
const keypair = ed.createKeyPair(seed);

console.log(keypair);

const value = Buffer.alloc(200).fill('whatever'); // the payload you want to send
const opts = {
  k: keypair.publicKey,
  seq: 0,
  v: value,
  sign: function (buf) {
    return ed.sign(buf, keypair.publicKey, keypair.secretKey);
  }
};

const DHT = require('bittorrent-dht');
const dht = new DHT({ verify: ed.verify });

dht.put(opts, function (err, hash) {
  console.error('error=', err);
  console.log('hash=', hash);

  dht.get(hash, (err2, value) => {
    console.error('error2', err2);
    console.log('value', value, value.v.toString());
  });
});
