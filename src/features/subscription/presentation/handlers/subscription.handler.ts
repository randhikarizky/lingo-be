import { z } from "zod";

import { listPublicPlans } from "@/features/subscription/domain/constants/plan-catalog";
import { planService } from "@/features/subscription/application/plan.service";
import { quotaService } from "@/features/subscription/application/quota.service";
import { requireAuth } from "@/global/middleware/auth.guard";
import { errorResponse, successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";

export async function subscriptionPlansHandler() {
  return withCors(successResponse({ plans: listPublicPlans() }));
}

export async function subscriptionMeHandler() {
  try {
    const auth = await requireAuth();
    const snapshot = await quotaService.getUsageSnapshot(auth.userId);
    const userPlan = await planService.ensureUserPlan(auth.userId);

    return withCors(
      successResponse({
        plan: snapshot.planId,
        status: userPlan.status,
        startedAt: userPlan.startedAt.toISOString(),
        expiredAt: userPlan.expiredAt?.toISOString() ?? null,
        limits: {
          speakingMinutesPerDay: snapshot.definition.speakingMinutesPerDay,
          aiRepliesPerDay: snapshot.definition.aiRepliesPerDay,
          activeConversations: snapshot.definition.activeConversations,
        },
        usage: snapshot.usage,
        remaining: snapshot.remaining,
        activeConversations: snapshot.activeConversations,
        features: {
          allScenarios: snapshot.definition.scenarios === "all",
          allTutors: snapshot.definition.tutors === "all",
          allowedScenarios:
            snapshot.definition.scenarios === "all"
              ? "all"
              : snapshot.definition.scenarios,
          allowedTutors:
            snapshot.definition.tutors === "all"
              ? "all"
              : snapshot.definition.tutors,
          sessionSummary: snapshot.definition.sessionSummary,
          priorityProcessing: snapshot.definition.priorityProcessing,
        },
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return withCors(errorResponse("Unauthorized", 401));
    }

    return withCors(errorResponse("Gagal memuat paket pengguna", 500));
  }
}

const upgradeSchema = z.object({
  plan: z.enum(["PRO", "LIFETIME"]),
});

export async function subscriptionUpgradeHandler(request: Request) {
  try {
    const auth = await requireAuth();
    const allowDirectUpgrade = process.env.ALLOW_DIRECT_UPGRADE === "true";

    if (!allowDirectUpgrade) {
      return withCors(
        errorResponse(
          "Upgrade langsung dinonaktifkan. Silakan lakukan pembayaran melalui halaman Pricing.",
          403,
        ),
      );
    }

    const body = await request.json();
    const parsed = upgradeSchema.safeParse(body);

    if (!parsed.success) {
      return withCors(errorResponse(parsed.error.issues[0].message, 422));
    }

    await planService.upgradePlan(auth.userId, parsed.data.plan);
    const snapshot = await quotaService.getUsageSnapshot(auth.userId);

    return withCors(
      successResponse(
        {
          plan: snapshot.planId,
          message:
            "Upgrade berhasil disimpan. Integrasi pembayaran akan dihubungkan pada rilis berikutnya.",
        },
        "Upgrade paket berhasil",
      ),
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return withCors(errorResponse("Unauthorized", 401));
    }

    return withCors(errorResponse("Gagal upgrade paket", 500));
  }
}
