import { ILogger } from './interfaces/ILogger';
import LogLevel from 'loglevel';

export class LoglevelLogger implements ILogger {
  private readonly _logger: LogLevel.Logger;

  constructor() {
    console.log('Creating logger');
    this._logger = LogLevel.getLogger('Knot');
    this._logger.setDefaultLevel('info');
  }
  trace(message?: unknown, ...optionalParams: unknown[]): void {
    this._logger.trace(message, ...optionalParams);
  }
  debug(message?: unknown, ...optionalParams: unknown[]): void {
    this._logger.debug(message, ...optionalParams);
  }

  log(message?: unknown, ...optionalParams: unknown[]): void {
    this._logger.info(message, ...optionalParams);
  }
  info(message?: unknown, ...optionalParams: unknown[]): void {
    this._logger.info(message, ...optionalParams);
  }
  warn(message?: unknown, ...optionalParams: unknown[]): void {
    this._logger.warn(message, ...optionalParams);
  }
  error(message?: unknown, ...optionalParams: unknown[]): void {
    this._logger.error(message, ...optionalParams);
  }
  fatal(message?: unknown, ...optionalParams: unknown[]): void {
    this._logger.error(`FATAL: ${message}`, ...optionalParams);
    process.exit(-1);
  }
}
