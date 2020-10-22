import { injectAll, singleton } from 'tsyringe';

import { ISigningAlgorithm, SupportedSignatureAlgorithms } from './interfaces/ISigningAlgorithm';
import { ISigningService } from './interfaces/ISigningService';

@singleton()
export class SigningService implements ISigningService {
  private readonly strategies: { [x: string]: ISigningAlgorithm } = {};

  constructor(@injectAll('ISigningAlgorithm') signingAlgos: ISigningAlgorithm[]) {
    for (const algo of signingAlgos) {
      this.strategies[algo.algorithm] = algo;
    }
  }

  public sign(data: Buffer, supportedSignatureAlgos: SupportedSignatureAlgorithms, privateKey: Buffer, publicKey?: Buffer) {
    return this.strategies[supportedSignatureAlgos].sign(data, privateKey, publicKey);
  }

  public generateKeyPair(supportedSignatureAlgos: SupportedSignatureAlgorithms) {
    return this.strategies[supportedSignatureAlgos].generateKeyPair();
  }

  public verify(message: Buffer, signature: Buffer, publicKey: Buffer, supportedSignatureAlgos: SupportedSignatureAlgorithms) {
    return this.strategies[supportedSignatureAlgos].verify(message, signature, publicKey);
  }
}
