// Generate by [js2dts@0.3.3](https://github.com/whxaxes/js2dts#readme)
import { Buffer } from 'node/globals';


/**
 * Instantiate an address from an address String or Buffer, a public key or script hash Buffer,
 * or an instance of {@link PublicKey} or {@link Script}.
 *
 * This is an immutable class, and if the first parameter provided to this constructor is an
 * `Address` instance, the same argument will be returned.
 *
 * An address has two key properties: `network` and `type`. The type is either
 * `Address.PayToPublicKeyHash` (value is the `'pubkeyhash'` string)
 * or `Address.PayToScriptHash` (the string `'scripthash'`). The network is an instance of {@link Network}.
 * You can quickly check whether an address is of a given kind by using the methods
 * `isPayToPublicKeyHash` and `isPayToScriptHash`
 *
 * @example
 * ```javascript
 * // validate that an input field is valid
 * var error = Address.getValidationError(input, 'testnet');
 * if (!error) {
 *   var address = Address(input, 'testnet');
 * } else {
 *   // invalid network or checksum (typo?)
 *   var message = error.messsage;
 * }
 *
 * // get an address from a public key
 * var address = Address(publicKey, 'testnet').toString();
 * ```
 *
 * @param {*} data - The encoded data in various formats
 * @param {Network|String|number=} network - The network: 'livenet' or 'testnet'
 * @param {string=} type - The type of address: 'script' or 'pubkey'
 * @returns {Address} A new valid and frozen instance of an Address
 * @constructor
 */
declare class Address {
  constructor(data: any, network: any, type: string);
  /** @static */
  static PayToPublicKeyHash: string;
  /** @static */
  static PayToScriptHash: string;
  /**
   * Creates a P2SH address from a set of public keys and a threshold.
   *
   * The addresses will be sorted lexicographically, as that is the trend in bitcoin.
   * To create an address from unsorted public keys, use the {@link Script#buildMultisigOut}
   * interface.
   *
   * @param {Array} publicKeys - a set of public keys to create an address
   * @param {number} threshold - the number of signatures needed to release the funds
   * @param {String|Network} network - either a Network instance, 'livenet', or 'testnet'
   * @return {Address}
   */
  static createMultisig(publicKeys: any[], threshold: number, network: any): Address;
  /**
   * Instantiate an address from a PublicKey instance
   *
   * @param {PublicKey} data
   * @param {String|Network} network - either a Network instance, 'livenet', or 'testnet'
   * @returns {Address} A new valid and frozen instance of an Address
   */
  static fromPublicKey(data: any, network: any): Address;
  /**
   * Instantiate an address from a PrivateKey instance
   *
   * @param {PrivateKey} privateKey
   * @param {String|Network} network - either a Network instance, 'livenet', or 'testnet'
   * @returns {Address} A new valid and frozen instance of an Address
   */
  static fromPrivateKey(privateKey: any, network: any): Address;
  /**
   * Instantiate an address from a ripemd160 public key hash
   *
   * @param {Buffer} hash - An instance of buffer of the hash
   * @param {String|Network} network - either a Network instance, 'livenet', or 'testnet'
   * @returns {Address} A new valid and frozen instance of an Address
   */
  static fromPublicKeyHash(hash: Buffer, network: any): Address;
  /**
   * Instantiate an address from a ripemd160 script hash
   *
   * @param {Buffer} hash - An instance of buffer of the hash
   * @param {String|Network} network - either a Network instance, 'livenet', or 'testnet'
   * @returns {Address} A new valid and frozen instance of an Address
   */
  static fromScriptHash(hash: Buffer, network: any): Address;
  /**
   * Builds a p2sh address paying to script. This will hash the script and
   * use that to create the address.
   * If you want to extract an address associated with a script instead,
   * see {{Address#fromScript}}
   *
   * @param {Script} script - An instance of Script
   * @param {String|Network} network - either a Network instance, 'livenet', or 'testnet'
   * @returns {Address} A new valid and frozen instance of an Address
   */
  static payingTo(script: any, network: any): Address;
  /**
   * Extract address from a Script. The script must be of one
   * of the following types: p2pkh input, p2pkh output, p2sh input
   * or p2sh output.
   * This will analyze the script and extract address information from it.
   * If you want to transform any script to a p2sh Address paying
   * to that script's hash instead, use {{Address#payingTo}}
   *
   * @param {Script} script - An instance of Script
   * @param {String|Network} network - either a Network instance, 'livenet', or 'testnet'
   * @returns {Address} A new valid and frozen instance of an Address
   */
  static fromScript(script: any, network: any): Address;
  /**
   * Instantiate an address from a buffer of the address
   *
   * @param {Buffer} buffer - An instance of buffer of the address
   * @param {String|Network=} network - either a Network instance, 'livenet', or 'testnet'
   * @param {string=} type - The type of address: 'script' or 'pubkey'
   * @returns {Address} A new valid and frozen instance of an Address
   */
  static fromBuffer(buffer: Buffer, network?: any, type?: string): Address;
  static fromHex(hex: any, network: any, type: any): Address;
  /**
   * Instantiate an address from an address string
   *
   * @param {string} str - An string of the bitcoin address
   * @param {String|Network=} network - either a Network instance, 'livenet', or 'testnet'
   * @param {string=} type - The type of address: 'script' or 'pubkey'
   * @returns {Address} A new valid and frozen instance of an Address
   */
  static fromString(str: string, network?: any, type?: string): Address;
  /**
   * Instantiate an address from an Object
   *
   * @param {string} json - An JSON string or Object with keys: hash, network and type
   * @returns {Address} A new valid instance of an Address
   */
  static fromObject(obj: any): Address;
  /**
   * Will return a validation error if exists
   *
   * @example
   * ```javascript
   * // a network mismatch error
   * var error = Address.getValidationError('15vkcKf7gB23wLAnZLmbVuMiiVDc1Nm4a2', 'testnet');
   * ```
   *
   * @param {string} data - The encoded data
   * @param {String|Network} network - either a Network instance, 'livenet', or 'testnet'
   * @param {string} type - The type of address: 'script' or 'pubkey'
   * @returns {null|Error} The corresponding error message
   */
  static getValidationError(data: string, network: any, type: string): Error;
  /**
   * Will return a boolean if an address is valid
   *
   * @example
   * ```javascript
   * assert(Address.isValid('15vkcKf7gB23wLAnZLmbVuMiiVDc1Nm4a2', 'livenet'));
   * ```
   *
   * @param {string} data - The encoded data
   * @param {String|Network} network - either a Network instance, 'livenet', or 'testnet'
   * @param {string} type - The type of address: 'script' or 'pubkey'
   * @returns {boolean} The corresponding error message
   */
  static isValid(data: string, network: any, type: string): boolean;
  /**
   * Returns true if an address is of pay to public key hash type
   * @return boolean
   */
  isPayToPublicKeyHash(): boolean;
  /**
   * Returns true if an address is of pay to script hash type
   * @return boolean
   */
  isPayToScriptHash(): boolean;
  /**
   * Will return a buffer representation of the address
   *
   * @returns {Buffer} Bitcoin address buffer
   */
  toBuffer(): Buffer;
  toHex(): string;
  /**
   * @returns {Object} A plain object with the address information
   */
  toJSON(): any;
  /**
   * @returns {Object} A plain object with the address information
   */
  toObject(): any;
  /**
   * Will return a string formatted for the console
   *
   * @returns {string} Bitcoin address
   */
  inspect(): string;
  /**
   * Will return a the base58 string representation of the address
   *
   * @returns {string} Bitcoin address
   */
  toString(): string;
}
declare const _Address: typeof Address;
export = _Address;
