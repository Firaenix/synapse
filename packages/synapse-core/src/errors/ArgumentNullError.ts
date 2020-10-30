export class ArgumentNullError extends Error {
  constructor(name: string) {
    super(`Argument is null: ${name}`);
  }
}
