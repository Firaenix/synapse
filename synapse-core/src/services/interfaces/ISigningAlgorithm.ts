export enum SupportedSignatureAlgorithms {
  ed25519 = 'ed25519',
  secp256k1 = 'secp256k1'
}

export interface ISigningAlgorithm {
  algorithm: SupportedSignatureAlgorithms;

  generateKeyPair: () => Promise<KeyPair>;
  sign: (message: Buffer, privateKey: Buffer, publicKey?: Buffer) => Promise<Buffer>;
  verify: (message: Buffer, signature: Buffer, publicKey: Buffer) => Promise<boolean>;
}

export interface KeyPair {
  publicKey: Buffer;
  secretKey: Buffer;

  isValidKeyPair: () => boolean;
}
