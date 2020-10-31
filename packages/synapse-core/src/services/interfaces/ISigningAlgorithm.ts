export enum SupportedSignatureAlgorithms {
  secp256k1 = 'secp256k1'
}

export interface ISigningAlgorithm {
  algorithm: SupportedSignatureAlgorithms | string;

  generateKeyPair: () => Promise<KeyPair>;
  sign: (message: Buffer, privateKey: Buffer, publicKey?: Buffer) => Promise<Buffer>;
  verify: (message: Buffer, signature: Buffer, publicKey: Buffer) => Promise<boolean>;
}

export interface KeyPair {
  publicKey: Buffer;
  secretKey: Buffer;

  isValidKeyPair: () => Promise<boolean>;
}
