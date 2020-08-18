import chalk from 'chalk';
import LogLevel from 'loglevel';
import { singleton } from 'tsyringe';

import { ILogger } from './interfaces/ILogger';

const colouredLogger = (methodName: string, logLevel: LogLevel.LogLevelNumbers, loggerName: string) => {
  const colours: { [k: string]: (...msg: string[]) => string } = {
    ['trace']: chalk.green,
    ['debug']: chalk.bgBlue,
    ['info']: chalk.white,
    ['warn']: chalk.hex('#ff8d33'),
    ['error']: chalk.bgRed
  };

  const rawMethod = LogLevel.methodFactory(methodName, logLevel, loggerName);
  const messageColor = colours[methodName];

  return function (message, ...optionalParams: string[]) {
    rawMethod(`${chalk.cyan.underline(loggerName)} - [${messageColor(methodName.toUpperCase())}] - ${messageColor(message)}`);
  };
};

const JSONLogger = (extra: any = {}) => (methodName: string, logLevel: LogLevel.LogLevelNumbers, loggerName: string) => {
  const rawMethod = LogLevel.methodFactory(methodName, logLevel, loggerName);

  return function (message, ...optionalParams) {
    rawMethod(JSON.stringify({ application: loggerName, msg: message, level: methodName.toUpperCase(), ...extra }));
  };
};

@singleton()
export class LoglevelLogger implements ILogger {
  private readonly _logger: LogLevel.Logger;

  constructor(ctx?: string) {
    console.log('Creating logger');
    this._logger = LogLevel.getLogger(['Knot', ctx].filter((x) => !!x).join(' - '));
    // this._logger.setDefaultLevel('trace');
    // this._logger.methodFactory = colouredLogger;
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

export class ConsoleLogger implements ILogger {
  trace(message?: unknown, ...optionalParams: unknown[]): void {
    console.log(message, ...optionalParams);
  }
  debug(message?: unknown, ...optionalParams: unknown[]): void {
    console.log(message, ...optionalParams);
  }

  log(message?: unknown, ...optionalParams: unknown[]): void {
    console.log(message, ...optionalParams);
  }
  info(message?: unknown, ...optionalParams: unknown[]): void {
    console.log(message, ...optionalParams);
  }
  warn(message?: unknown, ...optionalParams: unknown[]): void {
    console.warn(message, ...optionalParams);
  }
  error(message?: unknown, ...optionalParams: unknown[]): void {
    console.error(message, ...optionalParams);
  }
  fatal(message?: unknown, ...optionalParams: unknown[]): void {
    console.error(`FATAL: ${message}`, ...optionalParams);
    process.exit(-1);
  }
}
