import type { PlanStatus, PlanType } from "@prisma/client";

import { prisma } from "@/global/database/prisma";
import {
  getPlanDefinition,
  type PlanId,
} from "@/features/subscription/domain/constants/plan-catalog";

function resolveActivePlanId(plan: PlanType, status: PlanStatus): PlanId {
  if (status !== "ACTIVE") {
    return "FREE";
  }

  return plan as PlanId;
}

export class PlanService {
  async ensureUserPlan(userId: string) {
    const existing = await prisma.userPlan.findUnique({
      where: { userId },
    });

    if (existing) {
      return existing;
    }

    return prisma.userPlan.create({
      data: {
        userId,
        plan: "FREE",
        status: "ACTIVE",
      },
    });
  }

  async getActivePlanId(userId: string): Promise<PlanId> {
    const userPlan = await this.ensureUserPlan(userId);
    return resolveActivePlanId(userPlan.plan, userPlan.status);
  }

  async getUserPlanSnapshot(userId: string) {
    const userPlan = await this.ensureUserPlan(userId);
    const planId = resolveActivePlanId(userPlan.plan, userPlan.status);
    const definition = getPlanDefinition(planId);

    return {
      userPlan,
      planId,
      definition,
    };
  }

  async upgradePlan(userId: string, targetPlan: PlanId) {
    await this.ensureUserPlan(userId);

    return prisma.userPlan.update({
      where: { userId },
      data: {
        plan: targetPlan,
        status: "ACTIVE",
        startedAt: new Date(),
        expiredAt: targetPlan === "LIFETIME" ? null : null,
      },
    });
  }

  async activatePaidPlan(
    userId: string,
    targetPlan: PlanType,
    expiredAt: Date | null,
  ) {
    await this.ensureUserPlan(userId);

    return prisma.userPlan.update({
      where: { userId },
      data: {
        plan: targetPlan,
        status: "ACTIVE",
        startedAt: new Date(),
        expiredAt,
      },
    });
  }
}

export const planService = new PlanService();
