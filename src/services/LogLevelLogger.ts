import chalk from 'chalk';

import { ILogger } from './interfaces/ILogger';

enum LogLevels {
  Trace = 0,
  Debug = 1,
  Info = 2,
  Warn = 3,
  Error = 4,
  Fatal = 5
}

export class ConsoleLogger implements ILogger {
  private minLevel: LogLevels;
  constructor() {
    this.minLevel = LogLevels.Trace;
  }

  trace(message?: unknown, ...optionalParams: unknown[]): void {
    if (this.minLevel > LogLevels.Trace) {
      return;
    }
    console.log(chalk.greenBright(`[TRACE] - ${message}`), ...optionalParams);
  }
  debug(message?: unknown, ...optionalParams: unknown[]): void {
    if (this.minLevel > LogLevels.Debug) {
      return;
    }
    console.log(chalk.blue(`[DEBUG] - ${message}`), ...optionalParams);
  }

  log(message?: unknown, ...optionalParams: unknown[]): void {
    this.debug(message, ...optionalParams);
  }
  info(message?: unknown, ...optionalParams: unknown[]): void {
    if (this.minLevel > LogLevels.Info) {
      return;
    }
    console.log(chalk.cyan(`[INFO] - ${message}`), ...optionalParams);
  }
  warn(message?: unknown, ...optionalParams: unknown[]): void {
    if (this.minLevel > LogLevels.Warn) {
      return;
    }
    console.log(chalk.yellow(`[WARN] - ${message}`), ...optionalParams);
  }
  error(message?: unknown, ...optionalParams: unknown[]): void {
    if (this.minLevel > LogLevels.Error) {
      return;
    }
    console.error(chalk.redBright(`[ERROR] - ${message}`), ...optionalParams);
  }
  fatal(message?: unknown, ...optionalParams: unknown[]): void {
    if (this.minLevel > LogLevels.Fatal) {
      return;
    }
    console.error(chalk.bgRedBright(`[FATAL] - ${message}`), ...optionalParams);
    process.exit(-1);
  }
}
