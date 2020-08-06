import { ISigningService } from './interfaces/ISigningService';
import { singleton, inject, injectAll } from 'tsyringe';
import hypersign from '@hyperswarm/hypersign';
import { ISigningAlgorithm, SupportedSignatureAlgorithms } from './interfaces/ISigningAlgorithm';

@singleton()
export class SigningService implements ISigningService {
  private readonly strategies: { [x: string]: ISigningAlgorithm } = {};

  constructor(@injectAll('ISigningAlgorithm') signingAlgos: ISigningAlgorithm[]) {
    for (const algo of signingAlgos) {
      this.strategies[algo.algorithm] = algo;
    }
  }

  public sign(data: Buffer, privateKey: Buffer, supportedSignatureAlgos: SupportedSignatureAlgorithms) {
    return this.strategies[supportedSignatureAlgos].sign(data, privateKey);
  }

  public generateKeyPair(supportedSignatureAlgos: SupportedSignatureAlgorithms) {
    return this.strategies[supportedSignatureAlgos].generateKeyPair();
  }

  public verify(message: Buffer, signature: Buffer, publicKey: Buffer, supportedSignatureAlgos: SupportedSignatureAlgorithms) {
    return this.strategies[supportedSignatureAlgos].verify(message, signature, publicKey);
  }
}
