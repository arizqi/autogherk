export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Network errors
    if (
      message.includes("fetch failed") ||
      message.includes("network") ||
      message.includes("econnreset") ||
      message.includes("econnrefused") ||
      message.includes("etimedout") ||
      message.includes("socket hang up")
    ) {
      return true;
    }
  }

  // HTTP status-based errors (works with both Anthropic SDK and Google GenAI errors)
  const status = (error as any)?.status ?? (error as any)?.statusCode;
  if (status === 429 || status === 503 || status === 502 || status === 500) {
    // Billing/quota exhaustion is NOT transient — retrying won't help.
    // Look for explicit signals in the error message.
    const msg = String((error as any)?.message ?? "").toLowerCase();
    if (
      msg.includes("prepayment credits") ||
      msg.includes("credits are depleted") ||
      msg.includes("billing") ||
      msg.includes("resource_exhausted") ||
      msg.includes("quota exceeded")
    ) {
      return false;
    }
    return true;
  }

  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelay = options?.baseDelay ?? 1000;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !isTransientError(error)) {
        throw error;
      }

      // Exponential backoff with jitter: baseDelay * 2^attempt + random jitter
      const exponentialDelay = baseDelay * Math.pow(2, attempt);
      const jitter = Math.random() * baseDelay;
      const delay = exponentialDelay + jitter;

      if (options?.onRetry) {
        options.onRetry(
          error instanceof Error ? error : new Error(String(error)),
          attempt + 1,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
