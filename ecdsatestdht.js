// const ed = require('bittorrent-dht-sodium');
var ED = require('elliptic').eddsa;
var ed = new ED('ed25519');
const keypair = ed.keyFromSecret(Buffer.alloc(64).fill('Hello'));

console.log(Buffer.from(keypair.getPublic('hex')), Buffer.from(keypair.getSecret('hex')));

const value = Buffer.alloc(200).fill('whatever'); // the payload you want to send
const opts = {
  k: keypair.getPublic('hex'),
  seq: 0,
  v: value,
  sign: function (buf) {
    const sig = ed.sign(buf, Buffer.from(keypair.getSecret('hex')));
    return Buffer.from(sig.toBytes());
  }
};

const DHT = require('bittorrent-dht');
const dht = new DHT({
  verify: (...args) => {
    console.log('Verify args', args);
    return ed.verify(args[0], args[1], keypair.getPublic());
  }
});

dht.put(opts, function (err, hash) {
  console.error('error=', err);
  console.log('hash=', hash);

  dht.get(hash, (err2, value) => {
    console.error('error2', err2);
    console.log('value', value, value.v.toString());
  });
});
