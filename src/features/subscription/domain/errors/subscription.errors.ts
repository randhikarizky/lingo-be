export class QuotaExceededError extends Error {
  code = "QUOTA_EXCEEDED" as const;
  quotaType: string;
  limit: number | null;
  used: number;

  constructor(
    message: string,
    quotaType: string,
    used: number,
    limit: number | null,
  ) {
    super(message);
    this.name = "QuotaExceededError";
    this.quotaType = quotaType;
    this.used = used;
    this.limit = limit;
  }
}

export class FeatureLockedError extends Error {
  code = "FEATURE_LOCKED" as const;
  feature: string;
  requiredPlan: string;

  constructor(message: string, feature: string, requiredPlan: string) {
    super(message);
    this.name = "FeatureLockedError";
    this.feature = feature;
    this.requiredPlan = requiredPlan;
  }
}

export function isQuotaExceededError(
  error: unknown,
): error is QuotaExceededError {
  return error instanceof QuotaExceededError;
}

export function isFeatureLockedError(
  error: unknown,
): error is FeatureLockedError {
  return error instanceof FeatureLockedError;
}
