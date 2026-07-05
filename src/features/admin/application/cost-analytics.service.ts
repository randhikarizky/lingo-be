import type { PlanType, UsageType } from "@prisma/client";

import {
  accumulateUsageType,
  emptyUsageTotals,
  estimateCostFromUsage,
  getCostRates,
  getCostRatesPublic,
  roundUsd,
  type UsageTotals,
} from "@/features/admin/domain/constants/cost-catalog";
import {
  PLAN_CATALOG,
  PLAN_ORDER,
} from "@/features/subscription/domain/constants/plan-catalog";
import { prisma } from "@/global/database/prisma";

function getStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildUsageFromGrouped(
  rows: Array<{ type: UsageType; _sum: { amount: number | null } }>,
): UsageTotals {
  return rows.reduce(
    (totals, row) =>
      accumulateUsageType(totals, row.type, row._sum.amount ?? 0),
    emptyUsageTotals(),
  );
}

export class CostAnalyticsService {
  async getCostReview(days = 30) {
    const since = getStartOfDay(new Date());
    since.setDate(since.getDate() - (days - 1));

    const [
      totalUsers,
      usersByPlan,
      usageByType,
      usageByUserAndType,
      recentLogs,
      userPlans,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.userPlan.groupBy({
        by: ["plan"],
        _count: { _all: true },
      }),
      prisma.usageLog.groupBy({
        by: ["type"],
        _sum: { amount: true },
      }),
      prisma.usageLog.groupBy({
        by: ["userId", "type"],
        _sum: { amount: true },
      }),
      prisma.usageLog.findMany({
        where: { createdAt: { gte: since } },
        select: { type: true, amount: true, createdAt: true },
      }),
      prisma.userPlan.findMany({
        select: { userId: true, plan: true },
      }),
    ]);

    const usageTotals = buildUsageFromGrouped(usageByType);
    const costBreakdown = estimateCostFromUsage(usageTotals);
    const rates = getCostRatesPublic();

    const planByUserId = new Map(
      userPlans.map((item) => [item.userId, item.plan]),
    );

    const usageByPlanMap = new Map<PlanType, UsageTotals>();
    for (const planId of PLAN_ORDER) {
      usageByPlanMap.set(planId, emptyUsageTotals());
    }

    const costByUser = new Map<string, UsageTotals>();

    for (const row of usageByUserAndType) {
      const amount = row._sum.amount ?? 0;
      const plan = planByUserId.get(row.userId) ?? "FREE";

      const planUsage = usageByPlanMap.get(plan) ?? emptyUsageTotals();
      usageByPlanMap.set(
        plan,
        accumulateUsageType(planUsage, row.type, amount),
      );

      const userUsage = costByUser.get(row.userId) ?? emptyUsageTotals();
      costByUser.set(
        row.userId,
        accumulateUsageType(userUsage, row.type, amount),
      );
    }

    const costByPlan = PLAN_ORDER.map((planId) => {
      const usage = usageByPlanMap.get(planId) ?? emptyUsageTotals();
      const cost = estimateCostFromUsage(usage);
      const users =
        usersByPlan.find((item) => item.plan === planId)?._count._all ?? 0;

      return {
        plan: planId,
        label: PLAN_CATALOG[planId].label,
        priceLabel: PLAN_CATALOG[planId].priceLabel,
        users,
        usage,
        costUsd: cost.totalUsd,
        avgCostPerUserUsd: users > 0 ? roundUsd(cost.totalUsd / users) : 0,
      };
    });

    const dailyTrendMap = new Map<string, UsageTotals>();

    for (const log of recentLogs) {
      const key = formatDateKey(log.createdAt);
      const current = dailyTrendMap.get(key) ?? emptyUsageTotals();
      dailyTrendMap.set(
        key,
        accumulateUsageType(current, log.type, log.amount),
      );
    }

    const dailyTrend = Array.from(dailyTrendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, usage]) => ({
        date,
        usage,
        costUsd: estimateCostFromUsage(usage).totalUsd,
      }));

    const topSpenders = Array.from(costByUser.entries())
      .map(([userId, usage]) => ({
        userId,
        usage,
        estimatedCostUsd: estimateCostFromUsage(usage).totalUsd,
      }))
      .sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd)
      .slice(0, 10);

    const topSpenderProfiles = await Promise.all(
      topSpenders.map(async (item) => {
        const user = await prisma.user.findUnique({
          where: { id: item.userId },
          select: { id: true, name: true, email: true },
        });

        return {
          userId: item.userId,
          name: user?.name ?? "Unknown",
          email: user?.email ?? "",
          plan: planByUserId.get(item.userId) ?? "FREE",
          usage: item.usage,
          estimatedCostUsd: item.estimatedCostUsd,
        };
      }),
    );

    const freePlanCost =
      costByPlan.find((item) => item.plan === "FREE")?.costUsd ?? 0;
    const paidPlanCost = costByPlan
      .filter((item) => item.plan !== "FREE")
      .reduce((sum, item) => sum + item.costUsd, 0);

    const activeUsersWithUsage = costByUser.size;
    const avgCostPerActiveUserUsd =
      activeUsersWithUsage > 0
        ? roundUsd(costBreakdown.totalUsd / activeUsersWithUsage)
        : 0;

    const last7DaysCost = dailyTrend
      .slice(-7)
      .reduce((sum, item) => sum + item.costUsd, 0);

    const projectedMonthlyCostUsd = roundUsd((last7DaysCost / 7) * 30);

    return {
      generatedAt: new Date().toISOString(),
      periodDays: days,
      totalUsers,
      activeUsersWithUsage,
      usageTotals,
      costBreakdown,
      estimatedProviderCostUsd: costBreakdown.totalUsd,
      costRates: rates,
      planBreakdown: PLAN_ORDER.map((planId) => {
        const found = usersByPlan.find((item) => item.plan === planId);

        return {
          plan: planId,
          label: PLAN_CATALOG[planId].label,
          users: found?._count._all ?? 0,
        };
      }),
      costByPlan,
      dailyTrend,
      topSpenders: topSpenderProfiles,
      insights: {
        freePlanCostUsd: roundUsd(freePlanCost),
        paidPlanCostUsd: roundUsd(paidPlanCost),
        avgCostPerActiveUserUsd,
        projectedMonthlyCostUsd,
        dominantCostDriver: this.resolveDominantDriver(costBreakdown),
      },
    };
  }

  private resolveDominantDriver(
    breakdown: ReturnType<typeof estimateCostFromUsage>,
  ) {
    const entries = [
      { key: "chat", value: breakdown.chatUsd },
      { key: "stt", value: breakdown.sttUsd },
      { key: "tts", value: breakdown.ttsUsd },
      { key: "speaking", value: breakdown.speakingUsd },
    ];

    entries.sort((a, b) => b.value - a.value);
    return entries[0]?.key ?? "chat";
  }
}

export const costAnalyticsService = new CostAnalyticsService();
