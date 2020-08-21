import chalk from 'chalk';

import { ILogger } from './interfaces/ILogger';

export class ConsoleLogger implements ILogger {
  trace(message?: unknown, ...optionalParams: unknown[]): void {
    console.log(chalk.greenBright(`[TRACE] - ${message}`), ...optionalParams);
  }
  debug(message?: unknown, ...optionalParams: unknown[]): void {
    console.log(chalk.blue(`[DEBUG] - ${message}`), ...optionalParams);
  }

  log(message?: unknown, ...optionalParams: unknown[]): void {
    this.debug(message, ...optionalParams);
  }
  info(message?: unknown, ...optionalParams: unknown[]): void {
    console.log(chalk.cyan(`[INFO] - ${message}`), ...optionalParams);
  }
  warn(message?: unknown, ...optionalParams: unknown[]): void {
    console.log(chalk.yellow(`[WARN] - ${message}`), ...optionalParams);
  }
  error(message?: unknown, ...optionalParams: unknown[]): void {
    console.error(chalk.redBright(`[ERROR] - ${message}`), ...optionalParams);
  }
  fatal(message?: unknown, ...optionalParams: unknown[]): void {
    console.error(chalk.bgRedBright(`[FATAL] - ${message}`), ...optionalParams);
    process.exit(-1);
  }
}
