// Generate by [js2dts@0.3.3](https://github.com/whxaxes/js2dts#readme)

declare module 'txforge' {
  /**
   * Forge transaction builder class.
   */
  export class Forge {
    tx: any;
    inputs: any[];
    outputs: any[];
    options: any;
    changeTo: string;
    changeScript: any;
    /**
     * Instantiates a new Forge instance.
     *
     * The accepted params are:
     *
     * * `inputs` - list of input objects or cast instances
     * * `outputs` - list of output objects or cast instances
     * * `changeTo` - address to send change to
     * * `changeScript` - bsv Script object to send change to
     * * `options` - set `rates` or `debug` options
     *
     * @param {Object} params Tx parameters
     * @constructor
     */
    constructor(T100?: any);
    /**
     * The sum of all inputs.
     *
     * @type {Number}
     */
    inputSum: number;
    /**
     * The sum of all outputs.
     *
     * @type {Number}
     */
    outputSum: number;
    /**
     * Adds the given input to the tx.
     *
     * The input should be a Cast instance, otherwise the given params will be
     * used to instantiate a P2PKH Cast.
     *
     * @param {Cast | Object} input Input Cast or P2PKH UTXO params
     * @returns {Forge}
     */
    addInput(input?: any): Forge;
    /**
     * Adds the given output params to the tx.
     *
     * The params object should contain one of the following properties:
     *
     * * `to` - Bitcoin address to create P2PKH output
     * * `script` - hex encoded output script
     * * `data` - array of chunks which will be automatically parsed into an OP_RETURN script
     *
     * Unless the output is an OP_RETURN data output, the params must contain a
     * `satoshis` property reflecting the number of satoshis to send.
     *
     * For advanced use, Cast instances can be given as outputs. This allows
     * sending to non-standard and custom scripts.
     *
     * @param {Object} output Output params
     * @returns {Forge}
     */
    addOutput(output?: any): Forge;
    /**
     * Builds the transaction on the forge instance.
     *
     * `build()` must be called first before attempting to sign. The
     * `unlockingScripts` are generated with signatures and other dynamic push
     * data zeroed out.
     *
     * @returns {Forge}
     */
    build(): Forge;
    /**
     * Iterates over the inputs and generates the `unlockingScript` for each TxIn.
     * Must be called after `build()`.
     *
     * The given `params` will be passed to each Cast instance. For most standard
     * transactions this is all that is needed. For non-standard transaction types
     * try calling `signTxIn(vin, params)` on individual inputs.
     *
     * @param {Object} params unlockingScript params
     * @returns {Forge}
     */
    sign(params: any): Forge;
    /**
     * Generates the `unlockingScript` for the TxIn specified by the given index.
     *
     * The given `params` will be passed to each Cast instance. This is useful for
     * non-standard transaction types as tailored `unlockingScript` params can be
     * passed to each Cast instance.
     *
     * @param {Number} vin Input index
     * @param {Object} params unlockingScript params
     */
    signTxIn(vin: number, params: any): this;
    /**
     * Estimates the fee of the current inputs and outputs.
     *
     * Will use the given miner rates, assuming they are in the Minercraft rates
     * format. If not given. will use the default rates set on the Forge instance.
     *
     * @param {Object} rates Miner Merchant API rates
     * @returns {Number}
     */
    estimateFee(rates?: any): number;
  }
}
