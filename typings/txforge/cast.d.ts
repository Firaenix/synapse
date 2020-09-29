// Generate by [js2dts@0.3.3](https://github.com/whxaxes/js2dts#readme)

declare module 'txforge' {
  import { Buffer } from 'node/globals';

  /**
   * Cast class
   *
   * Casts are an abstraction over transaction input and outputs. A cast provides
   * a simple, unified way for developers to define self contained modules
   * representing `lockingScript` and `unlockingScript` templates.
   *
   * The templates defined within a Cast are dynamic and allow complex scripts to
   * be build when given specific parameters.
   */
  export class Cast {
    script: any;
    size: any;
    setup(): any;
    validate(...args: any[]): void;
    /**
     * Instantiates a new Cast instance.
     *
     * @param {Object} cast Cast template object
     * @constructor
     */
    constructor(T100?: any);
    /**
     * Instantiates a `lockingScript` Cast instance.
     *
     * The following parameters are required:
     *
     * * `satoshis` - the amount to send in the output (also accepts `amount`)
     *
     * Additional parameters may be required, depending on the Cast template.
     *
     * @param {Object} cast Cast template object
     * @param {Object} params Cast parameters
     * @constructor
     */
    static lockingScript(cast: any, params?: any): LockingScript;
    /**
     * Instantiates an `unlockingScript` Cast instance.
     *
     * The following parameters are required:
     *
     * * `txid` - txid of the UTXO
     * * `script` - hex encoded script of the UTXO
     * * `satoshis` - the amount in the UTXO (also accepts `amount`)
     * * `vout` - the UTXO output index (also accepts `outputIndex` and `txOutNum`)
     *
     * Additional parameters may be required, depending on the Cast template.
     *
     * @param {Object} cast Cast template object
     * @param {Object} params Cast parameters
     * @constructor
     */
    static unlockingScript(cast: any, params?: any): UnlockingScript;
    /**
     * Returns the full generated script.
     *
     * Iterrates over the template and builds the script chunk by chunk.
     *
     * @returns {Script}
     */
    getScript(ctx: any, params: any): any;
    /**
     * Returns the estimated size of the script, based on the Cast template.
     *
     * @returns {Number}
     */
    getSize(): number;
  }

  /**
   * LockingScript Cast sub-class
   */
  export class LockingScript extends Cast {
    satoshis: number;
    params: any;
    /**
     * Instantiates a new LockingScript instance.
     *
     * @param {Object} cast Cast template object
     * @param {Number} satoshis Amount to send
     * @param {Object} params Other parameters
     * @constructor
     */
    constructor(cast: any, satoshis: number, params?: any);
    /**
     * Returns the estimated size of the entire TxOut object
     *
     * @returns {Number}
     */
    getSize(): number;
  }
  export interface T101 {
    [key: string]: any;
  }
  /**
   * UnlockingScript Cast sub-class
   */
  export class UnlockingScript extends Cast {
    txid: string;
    txHashBuf: Buffer;
    txOutNum: number;
    txOut: any;
    nSequence: number;
    params: T101;
    /**
     * Instantiates a new UnlockingScript instance.
     *
     * @param {Object} cast Cast template object
     * @param {String} txid UTXO transaction id
     * @param {Number} txOutNum UTXO output index
     * @param {TxOut} txOut UTXO TxOut object
     * @param {Number} nSequence nSequence number
     * @constructor
     */
    constructor(cast: any, txid: string, txOutNum: number, txOut: any, nSequence: number, params?: T101);
    /**
     * Returns the estimated size of the entire TxIn object
     *
     * @returns {Number}
     */
    getSize(): number;
    /**
     * Returns the full generated script.
     *
     * Adds a context object which is passed to each of the `unlockingScript`
     * template build functions.
     *
     * @returns {Script}
     */
    getScript(forge: any, params: any): any;
  }
}
