import { inject, injectAll, singleton } from 'tsyringe';

import { ILogger } from '../services/interfaces/ILogger';
import { ISigningAlgorithm, SupportedSignatureAlgorithms } from './interfaces/ISigningAlgorithm';
import { ISigningService } from './interfaces/ISigningService';

@singleton()
export class SigningService implements ISigningService {
  private readonly strategies: { [x: string]: ISigningAlgorithm } = {};

  constructor(@injectAll('ISigningAlgorithm') signingAlgos: ISigningAlgorithm[], @inject('ILogger') private readonly _logger: ILogger) {
    _logger.info('SigningService Strategies:', signingAlgos);

    for (const algo of signingAlgos) {
      this.strategies[algo.algorithm] = algo;
    }
  }

  public sign(data: Buffer, supportedSignatureAlgos: SupportedSignatureAlgorithms | string, privateKey: Buffer, publicKey?: Buffer) {
    const signingStrat = this.strategies[supportedSignatureAlgos];
    if (!signingStrat) {
      throw new Error(`No signing algorithm registered with the name: ${supportedSignatureAlgos}`);
    }

    return signingStrat.sign(data, privateKey, publicKey);
  }

  public generateKeyPair(supportedSignatureAlgos: SupportedSignatureAlgorithms | string) {
    const keyPairStrat = this.strategies[supportedSignatureAlgos];
    if (!keyPairStrat) {
      throw new Error(`No signing algorithm registered with the name: ${supportedSignatureAlgos}`);
    }

    return keyPairStrat.generateKeyPair();
  }

  public verify(message: Buffer, signature: Buffer, publicKey: Buffer, supportedSignatureAlgos: SupportedSignatureAlgorithms | string) {
    const verificationStrategy = this.strategies[supportedSignatureAlgos];
    if (!verificationStrategy) {
      throw new Error(`No signing algorithm registered with the name: ${supportedSignatureAlgos}`);
    }

    this._logger.debug(supportedSignatureAlgos, 'Verification Strategy:', verificationStrategy);
    return this.strategies[supportedSignatureAlgos].verify(message, signature, publicKey);
  }
}
