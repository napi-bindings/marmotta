import { format } from 'node:util';

export interface MarmottaError extends Error {
  code: string;
  exitCode: number;
}

export interface MarmottaErrorConstructor<C extends string = string, Args extends unknown[] = unknown[]> {
  new (...args: [...Args] | [...Args, { cause?: unknown }]): MarmottaError & { code: C };
  (...args: [...Args] | [...Args, { cause?: unknown }]): MarmottaError & { code: C };
  readonly prototype: MarmottaError & { code: C };
}

const genericErrorSymbol = Symbol.for('marmotta-error-generic');

function toString(this: MarmottaError): string {
  return `${this.name} [${this.code}]: ${this.message}`;
}

function isOptionsWithCause(value: unknown): value is { cause: unknown } {
  return typeof value === 'object' && value !== null && 'cause' in value;
}

export function createError<C extends string, Args extends unknown[] = unknown[]>(
  code: C | typeof genericErrorSymbol,
  message: string,
  exitCode = 1,
  Base: ErrorConstructor = Error,
  captureStackTrace = createError.captureStackTrace,
): MarmottaErrorConstructor<C, Args> {
  const isGeneric = code === genericErrorSymbol;
  const errorCode = (isGeneric ? 'MARMOTTA_ERROR' : code as string).toUpperCase();

  if (!errorCode) throw new Error('Marmotta error code must not be empty');
  if (!message) throw new Error('Marmotta error message must not be empty');

  const specificErrorSymbol = Symbol.for(`marmotta-error ${errorCode}`);

  function MarmottaErrorImpl(this: MarmottaError | undefined, ...args: unknown[]): MarmottaError {
    if (!new.target) return new (MarmottaErrorImpl as unknown as new (...a: unknown[]) => MarmottaError)(...args);
    const self = this as MarmottaError;

    self.code = errorCode;
    self.name = 'MarmottaError';
    self.exitCode = exitCode;

    const last = args.at(-1);
    if (isOptionsWithCause(last)) {
      self.cause = last.cause;
      args.pop();
    }

    self.message = format(message, ...args);

    if (Error.stackTraceLimit && captureStackTrace) Error.captureStackTrace(self, MarmottaErrorImpl);
    return self;
  }

  MarmottaErrorImpl.prototype = Object.create(Base.prototype, {
    constructor: { value: MarmottaErrorImpl, enumerable: false, writable: true, configurable: true },
    [genericErrorSymbol]: { value: true, enumerable: false, writable: false, configurable: false },
    [specificErrorSymbol]: { value: true, enumerable: false, writable: false, configurable: false },
  });

  const brand = isGeneric ? genericErrorSymbol : specificErrorSymbol;
  Object.defineProperty(MarmottaErrorImpl, Symbol.hasInstance, {
    value(instance: unknown) {
      return typeof instance === 'object' && instance !== null && Boolean((instance as Record<symbol, unknown>)[brand]);
    },
    configurable: false,
    writable: false,
    enumerable: false,
  });

  MarmottaErrorImpl.prototype[Symbol.toStringTag] = 'Error';
  MarmottaErrorImpl.prototype.toString = toString;

  return MarmottaErrorImpl as unknown as MarmottaErrorConstructor<C, Args>;
}

createError.captureStackTrace = true;

export const MarmottaError = createError(genericErrorSymbol, 'Marmotta error', 1);
