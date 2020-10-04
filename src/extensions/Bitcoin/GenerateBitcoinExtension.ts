import Wire from '@firaenix/bittorrent-protocol';
import bencode from 'bencode';
import fs from 'fs';
import { DependencyContainer } from 'tsyringe';

import { signingService } from '../..';
import { InjectedExtension } from '../../models/InjectedExtensions';
import { SECP256K1KeyPair } from '../../models/SECP256K1KeyPair';
import { ILogger } from '../../services/interfaces/ILogger';
import { SupportedSignatureAlgorithms } from '../../services/interfaces/ISigningAlgorithm';
import { SECP256K1SignatureAlgorithm } from '../../services/signaturealgorithms/SECP256K1SignatureAlgorithm';
import { BitcoinExtension } from './Bitcoin';

export const GenerateBitcoinExtension = async (filePath: string): Promise<(ioc: DependencyContainer) => InjectedExtension> => {
  if (process.env.REGEN === 'true') {
    const bitcoinKeys = await signingService.generateKeyPair(SupportedSignatureAlgorithms.secp256k1);
    const serialisedKeys = { secretKey: bitcoinKeys.secretKey.toString('hex'), publicKey: bitcoinKeys.publicKey.toString('hex') };
    fs.writeFileSync(filePath, bencode.encode(serialisedKeys));
  }

  const bencodedKeys = fs.readFileSync(filePath);
  const deserialisedKeys = bencode.decode(bencodedKeys);
  console.log('seederBitcoinKeys private', deserialisedKeys.secretKey.toString());

  const bitcoinExtension = (ioc: DependencyContainer) => (w: Wire) =>
    new BitcoinExtension(
      w,
      {
        getPrice: (index, offset, length) => {
          // 1sat for every 10KB
          const kb = length / 1000;
          return Math.ceil(kb);
        },
        keyPair: new SECP256K1KeyPair(Buffer.from(deserialisedKeys.publicKey.toString(), 'hex'), Buffer.from(deserialisedKeys.secretKey.toString(), 'hex'))
      },
      ioc.resolve(SECP256K1SignatureAlgorithm),
      ioc.resolve('IHashService'),
      ioc.resolve<ILogger>('ILogger')
    );

  return bitcoinExtension;
};
