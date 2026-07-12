import { costAnalyticsService } from "@/features/admin/application/cost-analytics.service";
import { billingMetricsService } from "@/features/billing/application/billing-metrics.service";
import { billingRetryQueue } from "@/features/billing/application/billing-retry-queue.service";
import { errorResponse, successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";

function isAdminAuthorized(request: Request) {
  const configuredKey = process.env.ADMIN_API_KEY?.trim();

  if (!configuredKey) {
    return process.env.NODE_ENV !== "production";
  }

  const providedKey = request.headers.get("x-admin-key")?.trim();
  return providedKey === configuredKey;
}

function parseDaysParam(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("days");
  const parsed = raw ? Number(raw) : 30;

  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 90) {
    return 30;
  }

  return Math.floor(parsed);
}

export async function adminMetricsHandler(request: Request) {
  if (!isAdminAuthorized(request)) {
    return withCors(errorResponse("Forbidden", 403));
  }

  const days = parseDaysParam(request);
  const [report, billing, retryQueueSize] = await Promise.all([
    costAnalyticsService.getCostReview(days),
    billingMetricsService.getSummary(),
    Promise.resolve(billingRetryQueue.size()),
  ]);

  return withCors(successResponse({ ...report, billing, retryQueueSize }));
}

export async function adminCostReviewHandler(request: Request) {
  return adminMetricsHandler(request);
}
