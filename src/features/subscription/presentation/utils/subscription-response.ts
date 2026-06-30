import { errorResponse } from "@/global/utils/response";
import {
  isFeatureLockedError,
  isQuotaExceededError,
} from "@/features/subscription/domain/errors/subscription.errors";

export function mapSubscriptionErrorResponse(error: unknown) {
  if (isQuotaExceededError(error)) {
    return errorResponse(error.message, 403, {
      code: error.code,
      quotaType: error.quotaType,
      used: error.used,
      limit: error.limit,
    });
  }

  if (isFeatureLockedError(error)) {
    return errorResponse(error.message, 403, {
      code: error.code,
      feature: error.feature,
      requiredPlan: error.requiredPlan,
    });
  }

  return null;
}
