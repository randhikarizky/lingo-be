type RateLimitPolicy = {
  windowMs: number;
  max: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export const RATE_LIMIT_POLICIES: Record<string, RateLimitPolicy> = {
  auth: { windowMs: 15 * 60 * 1000, max: 20 },
  ai: { windowMs: 60 * 1000, max: 40 },
  speech: { windowMs: 60 * 1000, max: 30 },
  api: { windowMs: 60 * 1000, max: 180 },
};

export function getClientIp(
  request: Request | { headers: Headers; ip?: string | null },
) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }

  if ("ip" in request && request.ip) {
    return request.ip;
  }

  return "unknown";
}

export function applyRateLimit(
  key: string,
  policyName: keyof typeof RATE_LIMIT_POLICIES,
) {
  const policy = RATE_LIMIT_POLICIES[policyName];
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + policy.windowMs });
    return { allowed: true as const, retryAfterSeconds: 0 };
  }

  if (bucket.count >= policy.max) {
    return {
      allowed: false as const,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true as const, retryAfterSeconds: 0 };
}

export function resolveRateLimitPolicy(
  pathname: string,
): keyof typeof RATE_LIMIT_POLICIES | null {
  if (
    pathname.startsWith("/api/v1/auth/login") ||
    pathname.startsWith("/api/v1/auth/register")
  ) {
    return "auth";
  }

  if (pathname.startsWith("/api/v1/ai/chat")) {
    return "ai";
  }

  if (
    pathname.startsWith("/api/v1/speech/transcribe") ||
    pathname.startsWith("/api/v1/speech/synthesize")
  ) {
    return "speech";
  }

  if (pathname.startsWith("/api/v1/")) {
    return "api";
  }

  return null;
}
