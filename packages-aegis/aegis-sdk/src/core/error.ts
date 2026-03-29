// ============================================================
// AEGIS Error Types — ported from libs/aegis-core/src/error.rs
// ============================================================

export class AegisError extends Error {
  constructor(
    public readonly code: AegisErrorCode,
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = 'AegisError';
  }

  static config(msg: string) { return new AegisError('CONFIG', msg, 500); }
  static authentication(msg: string) { return new AegisError('AUTHENTICATION', msg, 401); }
  static authorization(msg: string) { return new AegisError('AUTHORIZATION', msg, 403); }
  static validation(msg: string) { return new AegisError('VALIDATION', msg, 400); }
  static notFound(msg: string) { return new AegisError('NOT_FOUND', msg, 404); }
  static rateLimitExceeded() { return new AegisError('RATE_LIMIT', 'Rate limit exceeded', 429); }
  static externalService(msg: string) { return new AegisError('EXTERNAL_SERVICE', msg, 502); }
  static inference(msg: string) { return new AegisError('INFERENCE', msg, 500); }
  static ml(msg: string) { return new AegisError('ML', msg, 500); }
  static internal(msg: string) { return new AegisError('INTERNAL', msg, 500); }
}

export type AegisErrorCode =
  | 'CONFIG'
  | 'DATABASE'
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'RATE_LIMIT'
  | 'EXTERNAL_SERVICE'
  | 'INFERENCE'
  | 'ML'
  | 'IO'
  | 'SERIALIZATION'
  | 'INTERNAL';
