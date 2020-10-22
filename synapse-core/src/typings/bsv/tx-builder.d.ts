// Generate by [js2dts@0.3.3](https://github.com/whxaxes/js2dts#readme)

export interface T100 {
  tx: any;
  txIns: any;
  txOuts: any;
  uTxOutMap: any;
  sigOperations: any;
  changeScript: any;
  changeAmountBn: any;
  feeAmountBn: any;
  feePerKbNum: any;
  sigsPerInput: any;
  dust: any;
  dustChangeToFees: any;
  hashCache: any;
}
export interface T101 {
  useAllInputs: boolean;
}
declare class TxBuilder_1 {
  constructor(tx?: any, txIns?: any[], txOuts?: any[], uTxOutMap?: any, sigOperations?: any, changeScript: any, changeAmountBn: any, feeAmountBn: any, feePerKbNum?: any, nLockTime?: number, versionBytesNum?: number, sigsPerInput?: number, dust?: any, dustChangeToFees?: boolean, hashCache?: any);
  toJSON(): T100;
  fromJSON(json: any): this;
  setFeePerKbNum(feePerKbNum: any): this;
  setChangeAddress(changeAddress: any): this;
  setChangeScript(changeScript: any): this;
  /**
   * nLockTime is an unsigned integer.
   */
  setNLocktime(nLockTime: any): this;
  setVersion(versionBytesNum: any): this;
  /**
   * Sometimes one of your outputs or the change output will be less than
   * dust. Values less than dust cannot be broadcast. If you are OK with
   * sending dust amounts to fees, then set this value to true.
   */
  setDust(dust?: any): this;
  /**
   * Sometimes one of your outputs or the change output will be less than
   * dust. Values less than dust cannot be broadcast. If you are OK with
   * sending dust amounts to fees, then set this value to true. We
   * preferentially send all dust to the change if possible. However, that
   * might not be possible if the change itself is less than dust, in which
   * case all dust goes to fees.
   */
  sendDustChangeToFees(dustChangeToFees?: boolean): this;
  /**
   * Import a transaction partially signed by someone else. The only thing you
   * can do after this is sign one or more inputs. Usually used for multisig
   * transactions. uTxOutMap is optional. It is not necessary so long as you
   * pass in the txOut when you sign. You need to know the output when signing
   * an input, including the script in the output, which is why this is
   * necessary when signing an input.
   */
  importPartiallySignedTx(tx: any, uTxOutMap?: any, sigOperations?: any): this;
  /**
   * Pay "from" a script - in other words, add an input to the transaction.
   */
  inputFromScript(txHashBuf: any, txOutNum: any, txOut: any, script: any, nSequence: any): this;
  addSigOperation(txHashBuf: any, txOutNum: any, nScriptChunk: any, type: any, addressStr: any, nHashType: any): this;
  /**
   * Pay "from" a pubKeyHash output - in other words, add an input to the
   * transaction.
   */
  inputFromPubKeyHash(txHashBuf: any, txOutNum: any, txOut: any, pubKey: any, nSequence: any, nHashType: any): this;
  /**
   * An address to send funds to, along with the amount. The amount should be
   * denominated in satoshis, not bitcoins.
   */
  outputToAddress(valueBn: any, addr: any): this;
  /**
   * A script to send funds to, along with the amount. The amount should be
   * denominated in satoshis, not bitcoins.
   */
  outputToScript(valueBn: any, script: any): this;
  buildOutputs(): any;
  buildInputs(outAmountBn: any, extraInputsNum?: number): any;
  estimateSize(): number;
  estimateFee(extraFeeAmount?: any): any;
  /**
   * Builds the transaction and adds the appropriate fee by subtracting from
   * the change output. Note that by default the TxBuilder will use as many
   * inputs as necessary to pay the output amounts and the required fee. The
   * TxBuilder will not necessarily us all the inputs. To force the TxBuilder
   * to use all the inputs (such as if you wish to spend the entire balance
   * of a wallet), set the argument useAllInputs = true.
   */
  build(opts?: T101): this;
  sort(): this;
  /**
   * Check if all signatures are present in a multisig input script.
   */
  static allSigsPresent(m: any, script: any): boolean;
  /**
   * Remove blank signatures in a multisig input script.
   */
  static removeBlankSigs(script: any): any;
  fillSig(nIn: any, nScriptChunk: any, sig: any): this;
  /**
   * Sign an input, but do not fill the signature into the transaction. Return
   * the signature.
   *
   * For a normal transaction, subScript is usually the scriptPubKey. If
   * you're not normal because you're using OP_CODESEPARATORs, you know what
   * to do.
   */
  getSig(keyPair: any, nHashType?: number, nIn: any, subScript: any, flags?: any): any;
  /**
   * Asynchronously sign an input in a worker, but do not fill the signature
   * into the transaction. Return the signature.
   */
  asyncGetSig(keyPair: any, nHashType?: number, nIn: any, subScript: any, flags?: any): any;
  /**
   * Sign ith input with keyPair and insert the signature into the transaction.
   * This method only works for some standard transaction types. For
   * non-standard transaction types, use getSig.
   */
  signTxIn(nIn: any, keyPair: any, txOut: any, nScriptChunk: any, nHashType?: number, flags?: any): this;
  /**
   * Asynchronously sign ith input with keyPair in a worker and insert the
   * signature into the transaction.  This method only works for some standard
   * transaction types. For non-standard transaction types, use asyncGetSig.
   */
  asyncSignTxIn(nIn: any, keyPair: any, txOut: any, nScriptChunk: any, nHashType?: number, flags?: any): Promise<this>;
  signWithKeyPairs(keyPairs: any): this;
}
export const TxBuilder: typeof TxBuilder_1;
