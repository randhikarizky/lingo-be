import { prisma } from "@/global/database/prisma";
import { PLAN_CATALOG, PLAN_ORDER } from "@/features/subscription/domain/constants/plan-catalog";
import { errorResponse, successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";

const ESTIMATED_COST_PER_CHAT = 0.002;
const ESTIMATED_COST_PER_STT = 0.004;
const ESTIMATED_COST_PER_TTS = 0.003;
const ESTIMATED_COST_PER_SPEAKING_MINUTE = 0.001;

function isAdminAuthorized(request: Request) {
  const configuredKey = process.env.ADMIN_API_KEY?.trim();

  if (!configuredKey) {
    return process.env.NODE_ENV !== "production";
  }

  const providedKey = request.headers.get("x-admin-key")?.trim();
  return providedKey === configuredKey;
}

export async function adminMetricsHandler(request: Request) {
  if (!isAdminAuthorized(request)) {
    return withCors(errorResponse("Forbidden", 403));
  }

  const [usersByPlan, usageByType, topUsers, totalUsers] = await Promise.all([
    prisma.userPlan.groupBy({
      by: ["plan"],
      _count: { _all: true },
    }),
    prisma.usageLog.groupBy({
      by: ["type"],
      _sum: { amount: true },
    }),
    prisma.usageLog.groupBy({
      by: ["userId"],
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 10,
    }),
    prisma.user.count(),
  ]);

  const usageTotals = {
    speakingMinutes: 0,
    aiRequests: 0,
    sttRequests: 0,
    ttsRequests: 0,
  };

  for (const item of usageByType) {
    const amount = item._sum.amount ?? 0;

    switch (item.type) {
      case "SPEAKING":
        usageTotals.speakingMinutes += amount;
        break;
      case "CHAT":
        usageTotals.aiRequests += amount;
        break;
      case "STT":
        usageTotals.sttRequests += amount;
        break;
      case "TTS":
        usageTotals.ttsRequests += amount;
        break;
      default:
        break;
    }
  }

  const estimatedProviderCostUsd =
    usageTotals.aiRequests * ESTIMATED_COST_PER_CHAT +
    usageTotals.sttRequests * ESTIMATED_COST_PER_STT +
    usageTotals.ttsRequests * ESTIMATED_COST_PER_TTS +
    usageTotals.speakingMinutes * ESTIMATED_COST_PER_SPEAKING_MINUTE;

  const planBreakdown = PLAN_ORDER.map((planId) => {
    const found = usersByPlan.find((item) => item.plan === planId);

    return {
      plan: planId,
      label: PLAN_CATALOG[planId].label,
      users: found?._count._all ?? 0,
    };
  });

  const topActiveUsers = await Promise.all(
    topUsers.map(async (item) => {
      const user = await prisma.user.findUnique({
        where: { id: item.userId },
        select: { id: true, name: true, email: true },
      });

      return {
        userId: item.userId,
        name: user?.name ?? "Unknown",
        email: user?.email ?? "",
        totalUsage: item._sum.amount ?? 0,
      };
    })
  );

  return withCors(
    successResponse({
      totalUsers,
      planBreakdown,
      usageTotals,
      estimatedProviderCostUsd: Number(estimatedProviderCostUsd.toFixed(2)),
      topActiveUsers,
    })
  );
}
