// ============================================================
// AEGIS Retry Logic — exponential backoff with jitter
// ============================================================

export interface RetryConfig {
  /** Maximum number of retry attempts. Default: 3 */
  maxRetries?: number;
  /** Base delay in ms for first retry. Default: 1000 */
  baseDelay?: number;
  /** Maximum delay cap in ms. Default: 30000 */
  maxDelay?: number;
  /** HTTP status codes that trigger a retry. Default: [429, 500, 502, 503, 504] */
  retryableStatuses?: number[];
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  retryableStatuses: [429, 500, 502, 503, 504],
};

/**
 * Compute exponential backoff delay with jitter.
 * delay = min(maxDelay, baseDelay * 2^attempt) * (0.5 + random * 0.5)
 */
export function exponentialBackoff(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
): number {
  const delay = Math.min(maxDelay, baseDelay * Math.pow(2, attempt));
  // Add jitter: 50-100% of computed delay
  const jitter = 0.5 + Math.random() * 0.5;
  return Math.floor(delay * jitter);
}

/**
 * Error class for retryable HTTP errors.
 */
export class RetryableError extends Error {
  public readonly status: number;
  public readonly retryable: boolean;

  constructor(message: string, status: number, retryable: boolean) {
    super(message);
    this.name = 'RetryableError';
    this.status = status;
    this.retryable = retryable;
  }
}

/**
 * Execute an async function with retry logic.
 * Retries on RetryableError or errors with a retryable status code.
 * Non-retryable errors are thrown immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: RetryConfig,
): Promise<T> {
  const cfg: Required<RetryConfig> = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Check if this error is retryable
      const isRetryable = isRetryableError(err, cfg.retryableStatuses);

      if (!isRetryable || attempt >= cfg.maxRetries) {
        throw lastError;
      }

      // Wait before retry
      const delay = exponentialBackoff(attempt, cfg.baseDelay, cfg.maxDelay);
      await sleep(delay);
    }
  }

  // Should not reach here, but just in case
  throw lastError ?? new Error('Retry failed');
}

/**
 * Check if an error should trigger a retry.
 */
function isRetryableError(
  err: unknown,
  retryableStatuses: number[],
): boolean {
  if (err instanceof RetryableError) {
    return err.retryable;
  }

  // Check for fetch Response-like errors with status
  if (
    err !== null &&
    typeof err === 'object' &&
    'status' in err &&
    typeof (err as Record<string, unknown>).status === 'number'
  ) {
    return retryableStatuses.includes(
      (err as Record<string, unknown>).status as number,
    );
  }

  // Network errors (no status) are retryable
  if (err instanceof TypeError) {
    return true; // fetch network errors are TypeErrors
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
