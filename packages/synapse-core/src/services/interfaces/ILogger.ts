export interface ILogger {
  trace(message?: unknown, ...optionalParams: unknown[]): void;
  log(message?: unknown, ...optionalParams: unknown[]): void;
  debug(message?: unknown, ...optionalParams: unknown[]): void;

  info(message?: unknown, ...optionalParams: unknown[]): void;
  warn(message?: unknown, ...optionalParams: unknown[]): void;

  error(message?: unknown, ...optionalParams: unknown[]): void;

  fatal(message?: unknown, ...optionalParams: unknown[]): void;
}
