import type { Message } from "@prisma/client";

import { logAssistanceAnalyticsEvent } from "@/features/learning/application/adaptive-learning.analytics";
import { getMissionObjectiveDefinitions } from "@/features/learning/domain/constants/mission-objectives";
import type {
  AssistanceAction,
  AssistanceCooldown,
  AssistanceLevelUsed,
  AssistanceResponse,
  AssistanceState,
  MissionObjectiveStatus,
} from "@/features/learning/domain/types/adaptive-learning.types";
import type { DifficultyId } from "@/features/learning/domain/constants/difficulties";

type ConversationMessage = Pick<Message, "role" | "content">;

const COOLDOWN_SECONDS = [0, 30, 60] as const;

function normalizeDifficulty(difficulty: string): DifficultyId {
  if (difficulty === "intermediate" || difficulty === "advanced") {
    return difficulty;
  }
  return "beginner";
}

function createInitialState(): AssistanceState {
  return {
    hintCount: 0,
    lastHintAt: null,
    maxLevelUsed: "none",
    failedAttempts: 0,
    lastProgressAt: new Date().toISOString(),
    objectiveProgress: {},
  };
}

export function parseAssistanceState(value: unknown): AssistanceState {
  if (!value || typeof value !== "object") {
    return createInitialState();
  }

  const raw = value as Partial<AssistanceState>;
  return {
    hintCount: typeof raw.hintCount === "number" ? raw.hintCount : 0,
    lastHintAt: typeof raw.lastHintAt === "string" ? raw.lastHintAt : null,
    maxLevelUsed:
      raw.maxLevelUsed === "hint" ||
      raw.maxLevelUsed === "example" ||
      raw.maxLevelUsed === "coach"
        ? raw.maxLevelUsed
        : "none",
    failedAttempts:
      typeof raw.failedAttempts === "number" ? raw.failedAttempts : 0,
    lastProgressAt:
      typeof raw.lastProgressAt === "string"
        ? raw.lastProgressAt
        : new Date().toISOString(),
    objectiveProgress:
      raw.objectiveProgress && typeof raw.objectiveProgress === "object"
        ? (raw.objectiveProgress as Record<string, boolean>)
        : {},
  };
}

export class AdaptiveLearningService {
  createInitialState() {
    return createInitialState();
  }

  resolveCooldown(state: AssistanceState): AssistanceCooldown {
    if (state.hintCount <= 0) {
      return { allowed: true, waitSeconds: 0 };
    }

    const cooldownIndex = Math.min(
      state.hintCount,
      COOLDOWN_SECONDS.length - 1,
    );
    const requiredWait = COOLDOWN_SECONDS[cooldownIndex];

    if (!state.lastHintAt) {
      return { allowed: true, waitSeconds: 0 };
    }

    const elapsedSeconds = Math.floor(
      (Date.now() - new Date(state.lastHintAt).getTime()) / 1000,
    );

    if (elapsedSeconds >= requiredWait) {
      return { allowed: true, waitSeconds: 0 };
    }

    return {
      allowed: false,
      waitSeconds: requiredWait - elapsedSeconds,
    };
  }

  evaluateObjectiveProgress(
    scenarioType: string,
    messages: ConversationMessage[],
    storedProgress?: Record<string, boolean>,
  ) {
    const definitions = getMissionObjectiveDefinitions(scenarioType);
    const userMessages = messages.filter((message) => message.role === "USER");
    const progress = { ...(storedProgress ?? {}) };

    for (const definition of definitions) {
      if (progress[definition.id]) {
        continue;
      }

      const achieved = userMessages.some((message) =>
        definition.detectionPatterns.some((pattern) =>
          pattern.test(message.content),
        ),
      );

      if (achieved) {
        progress[definition.id] = true;
      }
    }

    return progress;
  }

  buildMissionObjectives(
    scenarioType: string,
    progress: Record<string, boolean>,
  ): MissionObjectiveStatus[] {
    const definitions = getMissionObjectiveDefinitions(scenarioType);
    const activeId =
      definitions.find((definition) => !progress[definition.id])?.id ?? null;

    return definitions.map((definition) => ({
      id: definition.id,
      label: definition.label,
      goal: definition.goal,
      tips: definition.tips,
      difficultyStars: definition.difficultyStars,
      achieved: Boolean(progress[definition.id]),
      isActive: definition.id === activeId,
    }));
  }

  getActiveObjectiveDefinition(
    scenarioType: string,
    progress: Record<string, boolean>,
  ) {
    const definitions = getMissionObjectiveDefinitions(scenarioType);
    return definitions.find((definition) => !progress[definition.id]) ?? null;
  }

  detectStuck(input: {
    idleSeconds?: number;
    objectiveStaleSeconds?: number;
    failedAttempts: number;
  }) {
    if ((input.idleSeconds ?? 0) >= 45) return true;
    if ((input.objectiveStaleSeconds ?? 0) >= 90) return true;
    if (input.failedAttempts >= 3) return true;
    return false;
  }

  applyUserMessage(
    state: AssistanceState,
    scenarioType: string,
    messages: ConversationMessage[],
  ) {
    const previousProgress = { ...state.objectiveProgress };
    const nextProgress = this.evaluateObjectiveProgress(
      scenarioType,
      messages,
      previousProgress,
    );

    const progressed = Object.keys(nextProgress).some(
      (key) => nextProgress[key] && !previousProgress[key],
    );

    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "USER");

    let failedAttempts = state.failedAttempts;

    if (lastUserMessage && !progressed) {
      const active = this.getActiveObjectiveDefinition(
        scenarioType,
        previousProgress,
      );
      if (active) {
        const matchesActive = active.detectionPatterns.some((pattern) =>
          pattern.test(lastUserMessage.content),
        );
        if (!matchesActive) {
          failedAttempts += 1;
        }
      }
    }

    if (progressed) {
      failedAttempts = 0;
    }

    return {
      ...state,
      objectiveProgress: nextProgress,
      failedAttempts,
      lastProgressAt: progressed
        ? new Date().toISOString()
        : state.lastProgressAt,
    };
  }

  handleAction(input: {
    action: AssistanceAction;
    scenarioType: string;
    difficulty: string;
    state: AssistanceState;
    messages: ConversationMessage[];
    idleSeconds?: number;
    objectiveStaleSeconds?: number;
    conversationId: string;
  }): { state: AssistanceState; response: AssistanceResponse } {
    let state = this.applyUserMessage(
      input.state,
      input.scenarioType,
      input.messages,
    );

    const missionObjectives = this.buildMissionObjectives(
      input.scenarioType,
      state.objectiveProgress,
    );
    const activeObjective = this.getActiveObjectiveDefinition(
      input.scenarioType,
      state.objectiveProgress,
    );
    const difficulty = normalizeDifficulty(input.difficulty);
    const stuckSuggested = this.detectStuck({
      idleSeconds: input.idleSeconds,
      objectiveStaleSeconds: input.objectiveStaleSeconds,
      failedAttempts: state.failedAttempts,
    });

    if (stuckSuggested) {
      logAssistanceAnalyticsEvent("mission_stuck", {
        conversationId: input.conversationId,
        failedAttempts: state.failedAttempts,
      });
    }

    const cooldown = this.resolveCooldown(state);
    const response: AssistanceResponse = {
      missionObjectives,
      activeObjectiveId: activeObjective?.id ?? null,
      stuckSuggested,
      cooldown,
      assistanceLevel: state.maxLevelUsed,
      hintCount: state.hintCount,
    };

    if (!activeObjective) {
      return { state, response };
    }

    if (input.action === "tooltip") {
      logAssistanceAnalyticsEvent("objective_tooltip_opened", {
        conversationId: input.conversationId,
        objectiveId: activeObjective.id,
      });
      return { state, response };
    }

    if (input.action === "dismiss" || input.action === "sync") {
      return { state, response };
    }

    if (!cooldown.allowed) {
      return { state, response };
    }

    if (input.action === "hint") {
      state = {
        ...state,
        hintCount: state.hintCount + 1,
        lastHintAt: new Date().toISOString(),
        maxLevelUsed:
          state.maxLevelUsed === "none" ? "hint" : state.maxLevelUsed,
      };
      response.hintText = activeObjective.hints[difficulty];
      response.hintCount = state.hintCount;
      response.assistanceLevel = state.maxLevelUsed;
      response.cooldown = this.resolveCooldown(state);
      logAssistanceAnalyticsEvent("hint_used", {
        conversationId: input.conversationId,
        objectiveId: activeObjective.id,
      });
      logAssistanceAnalyticsEvent("hint_opened", {
        conversationId: input.conversationId,
        objectiveId: activeObjective.id,
      });
      return { state, response };
    }

    if (input.action === "example") {
      state = {
        ...state,
        hintCount: state.hintCount + 1,
        lastHintAt: new Date().toISOString(),
        maxLevelUsed: "example",
      };
      response.examples = activeObjective.examples;
      response.hintCount = state.hintCount;
      response.assistanceLevel = state.maxLevelUsed;
      response.cooldown = this.resolveCooldown(state);
      logAssistanceAnalyticsEvent("example_opened", {
        conversationId: input.conversationId,
        objectiveId: activeObjective.id,
      });
      return { state, response };
    }

    if (input.action === "coach") {
      state = {
        ...state,
        hintCount: state.hintCount + 1,
        lastHintAt: new Date().toISOString(),
        maxLevelUsed: "coach",
      };
      response.coachMessage =
        difficulty === "advanced"
          ? `Great progress! There's one more thing I'd like you to try: ${activeObjective.label.toLowerCase()}.`
          : `Kamu hampir selesai! Masih ada satu langkah lagi: ${activeObjective.goal}`;
      response.hintCount = state.hintCount;
      response.assistanceLevel = state.maxLevelUsed;
      response.cooldown = this.resolveCooldown(state);
      return { state, response };
    }

    return { state, response };
  }

  getXpMultiplier(state: AssistanceState) {
    return state.hintCount > 0 ? 0.8 : 1;
  }

  getAssistanceSummary(state: AssistanceState) {
    const level = state.maxLevelUsed;
    if (level === "none" || state.hintCount === 0) {
      return {
        level: "independent" as const,
        label: "Penyelesaian Mandiri",
        description: "Kamu menyelesaikan seluruh misi tanpa bantuan apa pun.",
        emoji: "🎉",
      };
    }

    if (level === "hint") {
      return {
        level: "hint" as const,
        label: "Hint Used",
        description:
          "Kamu hanya membutuhkan satu petunjuk untuk menyelesaikan misi. Kerja bagus!",
        emoji: "💡",
      };
    }

    if (level === "example") {
      return {
        level: "example" as const,
        label: "Contoh Dibuka",
        description:
          "Kamu melihat contoh kalimat untuk melanjutkan misi. Tetap semangat!",
        emoji: "📝",
      };
    }

    return {
      level: "coach" as const,
      label: "AI Coach",
      description: "Tutor membantu mengarahkan langkah terakhirmu.",
      emoji: "🤖",
    };
  }
}

export const adaptiveLearningService = new AdaptiveLearningService();
