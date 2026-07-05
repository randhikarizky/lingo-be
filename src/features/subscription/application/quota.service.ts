import {
  getMinimumPlanForScenario,
  getMinimumPlanForTutor,
  getPlanDefinition,
  planIncludesScenario,
  planIncludesTutor,
  type PlanId,
} from "@/features/subscription/domain/constants/plan-catalog";
import {
  FeatureLockedError,
  QuotaExceededError,
} from "@/features/subscription/domain/errors/subscription.errors";
import { planService } from "@/features/subscription/application/plan.service";
import { usageService } from "@/features/subscription/application/usage.service";

function formatPlanLabel(planId: PlanId) {
  return getPlanDefinition(planId).label;
}

export class QuotaService {
  async getUsageSnapshot(userId: string) {
    const { planId, definition } =
      await planService.getUserPlanSnapshot(userId);
    const usage = await usageService.getDailyUsage(userId);
    const activeConversations =
      await usageService.getActiveConversationCount(userId);

    return {
      planId,
      definition,
      usage,
      activeConversations,
      remaining: {
        speakingMinutes:
          definition.speakingMinutesPerDay === null
            ? null
            : Math.max(
                0,
                definition.speakingMinutesPerDay - usage.speakingMinutes,
              ),
        aiReplies:
          definition.aiRepliesPerDay === null
            ? null
            : Math.max(0, definition.aiRepliesPerDay - usage.aiReplies),
        activeConversations:
          definition.activeConversations === null
            ? null
            : Math.max(0, definition.activeConversations - activeConversations),
      },
    };
  }

  async assertChatAllowed(userId: string) {
    const snapshot = await this.getUsageSnapshot(userId);
    const limit = snapshot.definition.aiRepliesPerDay;

    if (limit === null) {
      return snapshot;
    }

    if (snapshot.usage.aiReplies >= limit) {
      throw new QuotaExceededError(
        "Kuota latihan hari ini telah habis. Upgrade ke Starter untuk melanjutkan belajar tanpa batasan yang mengganggu.",
        "aiReplies",
        snapshot.usage.aiReplies,
        limit,
      );
    }

    return snapshot;
  }

  async assertSpeakingAllowed(userId: string, minutes: number) {
    const snapshot = await this.getUsageSnapshot(userId);
    const limit = snapshot.definition.speakingMinutesPerDay;

    if (limit === null) {
      return snapshot;
    }

    if (snapshot.usage.speakingMinutes + minutes > limit) {
      throw new QuotaExceededError(
        "Kuota speaking hari ini telah habis. Upgrade ke Starter untuk melanjutkan latihan suara.",
        "speakingMinutes",
        snapshot.usage.speakingMinutes,
        limit,
      );
    }

    return snapshot;
  }

  async assertCanCreateConversation(userId: string) {
    const snapshot = await this.getUsageSnapshot(userId);
    const limit = snapshot.definition.activeConversations;

    if (limit === null) {
      return snapshot;
    }

    if (snapshot.activeConversations >= limit) {
      throw new QuotaExceededError(
        "Batas conversation aktif tercapai. Selesaikan sesi lama atau upgrade paket untuk membuat sesi baru.",
        "activeConversations",
        snapshot.activeConversations,
        limit,
      );
    }

    return snapshot;
  }

  assertScenarioAllowed(
    planId: PlanId,
    scenarioId: string,
    scenarioLabel: string,
  ) {
    if (planIncludesScenario(planId, scenarioId)) {
      return;
    }

    const requiredPlan = getMinimumPlanForScenario(scenarioId);

    throw new FeatureLockedError(
      `${scenarioLabel} tersedia mulai paket ${formatPlanLabel(requiredPlan)}.`,
      "scenario",
      requiredPlan,
    );
  }

  assertTutorAllowed(planId: PlanId, characterId: string, tutorName: string) {
    if (planIncludesTutor(planId, characterId)) {
      return;
    }

    const requiredPlan = getMinimumPlanForTutor(characterId);

    throw new FeatureLockedError(
      `Tutor ${tutorName} tersedia mulai paket ${formatPlanLabel(requiredPlan)}.`,
      "tutor",
      requiredPlan,
    );
  }
}

export const quotaService = new QuotaService();
