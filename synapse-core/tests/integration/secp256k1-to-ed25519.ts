import 'reflect-metadata';

import { HashService } from './services/HashService';
import { ED25519SuperCopAlgorithm } from './services/signaturealgorithms/ED25519SuperCopAlgorithm';
import { SECP256K1SignatureAlgorithm } from './services/signaturealgorithms/SECP256K1SignatureAlgorithm';

(async () => {
  const secp256k1 = new SECP256K1SignatureAlgorithm(new HashService());
  const ed25519 = new ED25519SuperCopAlgorithm();

  const secpkeypair = await secp256k1.generateKeyPair();

  const ed25519keypair = await ed25519.generateKeyPair(secpkeypair.secretKey);

  console.log('ED25519:', ed25519keypair.publicKey.toString('hex'), ed25519keypair.secretKey.toString('hex'));
  console.log('SECP256k1:', secpkeypair.publicKey.toString('hex'), secpkeypair.secretKey.toString('hex'));
})();
