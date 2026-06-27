import { logWarn } from "@/global/utils/logger";

type RetryOptions = {
  maxAttempts: number;
  baseDelayMs: number;
  requestId?: string;
  label?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableHttpStatus(status: number) {
  return status === 429 || status >= 500;
}

function isRetryableError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("socket hang up") ||
    error.message.includes("(429)") ||
    /\([5][0-9]{2}\)/.test(error.message)
  );
}

export async function withExponentialBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { maxAttempts, baseDelayMs, requestId, label = "operation" } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt >= maxAttempts || !isRetryableError(error)) {
        throw error;
      }

      const delayMs = baseDelayMs * 2 ** (attempt - 1);

      if (requestId) {
        logWarn(requestId, `${label}.retry`, {
          attempt,
          maxAttempts,
          delayMs,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      await sleep(delayMs);
    }
  }

  throw lastError;
}

export { isRetryableHttpStatus, sleep };
