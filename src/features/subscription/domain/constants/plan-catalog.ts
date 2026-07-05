export type PlanId = "FREE" | "STARTER" | "PRO" | "LIFETIME";

export type PlanDefinition = {
  id: PlanId;
  label: string;
  description: string;
  priceLabel: string;
  speakingMinutesPerDay: number | null;
  aiRepliesPerDay: number | null;
  activeConversations: number | null;
  scenarios: "all" | string[];
  tutors: "all" | string[];
  sessionSummary: boolean;
  priorityProcessing: boolean;
  badge?: string;
};

export const PLAN_CATALOG: Record<PlanId, PlanDefinition> = {
  FREE: {
    id: "FREE",
    label: "Free",
    description: "Cocok untuk pengguna baru yang ingin mencoba Lingora.",
    priceLabel: "Rp0",
    speakingMinutesPerDay: 10,
    aiRepliesPerDay: 20,
    activeConversations: 3,
    scenarios: ["restaurant", "cafe", "shopping"],
    tutors: ["maya", "ken"],
    sessionSummary: true,
    priorityProcessing: false,
  },
  STARTER: {
    id: "STARTER",
    label: "Starter",
    description: "Untuk belajar rutin dengan akses skenario dan tutor lengkap.",
    priceLabel: "Rp99rb/bulan",
    speakingMinutesPerDay: 60,
    aiRepliesPerDay: 300,
    activeConversations: null,
    scenarios: "all",
    tutors: "all",
    sessionSummary: true,
    priorityProcessing: false,
    badge: "Populer",
  },
  PRO: {
    id: "PRO",
    label: "Pro",
    description:
      "Power user dengan akses tanpa batas dan prioritas pemrosesan.",
    priceLabel: "Rp199rb/bulan",
    speakingMinutesPerDay: null,
    aiRepliesPerDay: null,
    activeConversations: null,
    scenarios: "all",
    tutors: "all",
    sessionSummary: true,
    priorityProcessing: true,
  },
  LIFETIME: {
    id: "LIFETIME",
    label: "Lifetime",
    description: "Early adopter — benefit Pro tanpa biaya bulanan.",
    priceLabel: "Rp1,99jt sekali bayar",
    speakingMinutesPerDay: null,
    aiRepliesPerDay: null,
    activeConversations: null,
    scenarios: "all",
    tutors: "all",
    sessionSummary: true,
    priorityProcessing: true,
    badge: "Early Adopter",
  },
};

export const PLAN_ORDER: PlanId[] = ["FREE", "STARTER", "PRO", "LIFETIME"];

export function getPlanDefinition(plan: PlanId): PlanDefinition {
  return PLAN_CATALOG[plan];
}

export function isUnlimitedLimit(value: number | null) {
  return value === null;
}

export function planIncludesScenario(plan: PlanId, scenarioId: string) {
  const config = PLAN_CATALOG[plan];

  if (config.scenarios === "all") {
    return true;
  }

  return config.scenarios.includes(scenarioId);
}

export function planIncludesTutor(plan: PlanId, characterId: string) {
  const config = PLAN_CATALOG[plan];

  if (config.tutors === "all") {
    return true;
  }

  return config.tutors.includes(characterId);
}

export function getMinimumPlanForScenario(scenarioId: string): PlanId {
  for (const planId of PLAN_ORDER) {
    if (planIncludesScenario(planId, scenarioId)) {
      return planId;
    }
  }

  return "STARTER";
}

export function getMinimumPlanForTutor(characterId: string): PlanId {
  for (const planId of PLAN_ORDER) {
    if (planIncludesTutor(planId, characterId)) {
      return planId;
    }
  }

  return "STARTER";
}

export function listPublicPlans() {
  return PLAN_ORDER.map((id) => {
    const plan = PLAN_CATALOG[id];

    return {
      id: plan.id,
      label: plan.label,
      description: plan.description,
      priceLabel: plan.priceLabel,
      badge: plan.badge,
      limits: {
        speakingMinutesPerDay: plan.speakingMinutesPerDay,
        aiRepliesPerDay: plan.aiRepliesPerDay,
        activeConversations: plan.activeConversations,
      },
      features: {
        allScenarios: plan.scenarios === "all",
        allTutors: plan.tutors === "all",
        sessionSummary: plan.sessionSummary,
        priorityProcessing: plan.priorityProcessing,
      },
    };
  });
}
