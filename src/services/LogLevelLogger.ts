import chalk from 'chalk';
import LogLevel from 'loglevel';

import { ILogger } from './interfaces/ILogger';

const chalkColourFactory = (originalMethodFactory: LogLevel.MethodFactory) => (methodName, logLevel, loggerName) => {
  const colours: { [k: string]: (...msg: string[]) => string } = {
    ['trace']: chalk.green,
    ['debug']: chalk.bgBlue,
    ['info']: chalk.white,
    ['warn']: chalk.red,
    ['error']: chalk.bgRed
  };

  const rawMethod = originalMethodFactory(methodName, logLevel, loggerName);
  const logLevelNames = ['TRACE', 'DEBUG', 'INFO ', 'WARN ', 'ERROR'];
  const messageColor = colours[methodName];

  return function (message) {
    rawMethod(chalk.cyan.underline(loggerName) + ' ' + chalk.bold.magenta(logLevelNames[logLevel]) + ' ' + messageColor(message));
  };
};

export class LoglevelLogger implements ILogger {
  private readonly _logger: LogLevel.Logger;

  constructor() {
    console.log('Creating logger');
    this._logger = LogLevel.getLogger('Knot');
    this._logger.setDefaultLevel('trace');
    const originalFactory = this._logger.methodFactory;
    this._logger.methodFactory = chalkColourFactory(originalFactory);
  }
  trace(message?: unknown, ...optionalParams: unknown[]): void {
    this._logger.trace(message, ...optionalParams);
  }
  debug(message?: unknown, ...optionalParams: unknown[]): void {
    this._logger.debug(message, ...optionalParams);
  }

  log(message?: unknown, ...optionalParams: unknown[]): void {
    this._logger.warn(message, ...optionalParams);
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
