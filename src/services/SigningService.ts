import { ISigningService } from './interfaces/ISigningService';
import { singleton } from 'tsyringe';
import eccrypto from 'eccrypto';

type Strats = { [algo: string]: (buf: Buffer, prKey: Buffer) => Promise<Buffer> };

@singleton()
export class SigningService implements ISigningService {
  private strategies: Strats = {
    ['ecdsa']: this.ECDSASign
  };

  private ECDSASign(buf: Buffer, prKey: Buffer): Promise<Buffer> {
    return eccrypto.sign(prKey, buf);
  }

  public sign(data: Buffer, privateKey: Buffer, supportedSignatureAlgos: 'ecdsa') {
    return this.strategies[supportedSignatureAlgos](data, privateKey);
  }
}
