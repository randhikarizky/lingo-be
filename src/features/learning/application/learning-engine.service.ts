import type { Message } from "@prisma/client";

import { getScenario } from "@/features/learning/domain/constants/scenarios";
import { isValidDifficulty } from "@/features/learning/domain/constants/difficulties";
import { isValidScenario } from "@/features/learning/domain/constants/scenarios";
import { getModelForPersonality } from "@/features/learning/domain/constants/tutors";
import type {
  LearningSessionMetadata,
  SessionMetrics,
} from "@/features/learning/domain/types/learning-session.types";
import { promptBuilderService } from "@/features/learning/application/prompt-builder.service";

type ConversationMessage = Pick<Message, "role" | "content" | "correction">;

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function extractNewVocabulary(messages: ConversationMessage[]) {
  const words = new Set<string>();

  for (const message of messages) {
    if (!message.correction || !Array.isArray(message.correction)) {
      continue;
    }

    for (const item of message.correction) {
      if (
        item &&
        typeof item === "object" &&
        "correct" in item &&
        typeof (item as { correct: string }).correct === "string"
      ) {
        const correct = (item as { correct: string }).correct.trim();
        if (correct) {
          words.add(correct);
        }
      }
    }
  }

  return [...words];
}

export class LearningEngineService {
  validateSessionConfig(input: {
    scenarioType: string;
    difficulty: string;
    objective?: string;
  }) {
    if (!isValidScenario(input.scenarioType)) {
      throw new Error("Scenario tidak valid");
    }

    if (!isValidDifficulty(input.difficulty)) {
      throw new Error("Difficulty tidak valid");
    }
  }

  resolveObjective(scenarioType: string, objective?: string) {
    const scenario = getScenario(scenarioType);
    return objective?.trim() || scenario.objective;
  }

  buildSystemPrompt(metadata: LearningSessionMetadata) {
    return promptBuilderService.build(metadata);
  }

  resolveModel(personality: string) {
    return getModelForPersonality(personality);
  }

  computeMetrics(messages: ConversationMessage[]): SessionMetrics {
    const userMessages = messages.filter((message) => message.role === "USER");
    const wordsSpoken = userMessages.reduce(
      (total, message) => total + countWords(message.content),
      0,
    );

    let corrections = 0;

    for (const message of messages) {
      if (Array.isArray(message.correction)) {
        corrections += message.correction.length;
      } else if (message.role === "ASSISTANT") {
        corrections += [...message.content.matchAll(/\[([^|]+)\|([^\]]+)\]/g)]
          .length;
      }
    }

    const estimatedSpeakingMinutes = Math.max(1, Math.round(wordsSpoken / 130));

    return {
      wordsSpoken,
      corrections,
      newVocabulary: extractNewVocabulary(messages),
      estimatedSpeakingMinutes,
    };
  }
}

export const learningEngineService = new LearningEngineService();
