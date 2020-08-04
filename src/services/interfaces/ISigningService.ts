export interface ISigningService {
  sign(data: Buffer, privateKey: Buffer, supportedSignatureAlgos: 'ecdsa'): Promise<Buffer>;
}
