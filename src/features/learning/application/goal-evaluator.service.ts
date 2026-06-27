import type { Message } from "@prisma/client";

import { buildSessionGoalTemplates } from "@/features/learning/domain/constants/session-goals";
import type {
  SessionGoal,
  SessionMetrics,
} from "@/features/learning/domain/types/learning-session.types";

type ConversationMessage = Pick<Message, "role" | "content" | "correction">;

const INDONESIAN_MARKERS = [
  "yang",
  "dan",
  "tidak",
  "bisa",
  "saya",
  "kamu",
  "tolong",
  "artinya",
  "gimana",
  "bagaimana",
  "maksudnya",
  "dalam bahasa indonesia",
  "bahasa indonesia",
];

const HELP_SEEKING_PATTERNS = [
  /what does .+ mean/i,
  /how do you say/i,
  /can you translate/i,
  /in indonesian/i,
  /bantu/i,
  /tolong/i,
  /artinya apa/i,
  /maksudnya apa/i,
  /please translate/i,
];

function countWords(text: string) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function isCompleteSentence(text: string) {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;

  return countWords(trimmed) >= 5 || /[.!?]$/.test(trimmed);
}

function getUserMessages(messages: ConversationMessage[]) {
  return messages.filter((message) => message.role === "USER");
}

function countCompleteSentences(messages: ConversationMessage[]) {
  return getUserMessages(messages).filter((message) => isCompleteSentence(message.content)).length;
}

function extractCorrectedVocabulary(messages: ConversationMessage[]) {
  const words = new Set<string>();

  for (const message of messages) {
    if (Array.isArray(message.correction)) {
      for (const item of message.correction) {
        if (
          item &&
          typeof item === "object" &&
          "correct" in item &&
          typeof (item as { correct: string }).correct === "string"
        ) {
          words.add((item as { correct: string }).correct.trim().toLowerCase());
        }
      }
    }

    if (message.role === "ASSISTANT") {
      for (const match of message.content.matchAll(/\[([^|]+)\|([^\]]+)\]/g)) {
        words.add(match[2].trim().toLowerCase());
      }
    }
  }

  return words;
}

function countLearnedVocabulary(messages: ConversationMessage[]) {
  const correctedWords = extractCorrectedVocabulary(messages);
  if (correctedWords.size === 0) return 0;

  const userText = getUserMessages(messages)
    .map((message) => message.content.toLowerCase())
    .join(" ");

  let usedCount = 0;

  for (const word of correctedWords) {
    if (word.length > 0 && userText.includes(word)) {
      usedCount += 1;
    }
  }

  return usedCount;
}

function containsIndonesian(text: string) {
  const normalized = text.toLowerCase();

  if (/[à-úÀ-Ú]/.test(text)) {
    return false;
  }

  return INDONESIAN_MARKERS.some((marker) => normalized.includes(marker));
}

function countIndonesianMessages(messages: ConversationMessage[]) {
  return getUserMessages(messages).filter((message) => containsIndonesian(message.content)).length;
}

function isHelpSeekingMessage(text: string) {
  return HELP_SEEKING_PATTERNS.some((pattern) => pattern.test(text));
}

function countHelpSeekingMessages(messages: ConversationMessage[]) {
  return getUserMessages(messages).filter((message) => isHelpSeekingMessage(message.content)).length;
}

export class GoalEvaluatorService {
  buildGoals(difficulty: string): SessionGoal[] {
    return buildSessionGoalTemplates(difficulty);
  }

  evaluate(
    difficulty: string,
    messages: ConversationMessage[],
    storedGoals?: SessionGoal[] | null
  ): SessionGoal[] {
    const baseGoals = storedGoals?.length
      ? storedGoals.map((goal) => ({ ...goal, achieved: false, progress: 0, progressLabel: "" }))
      : this.buildGoals(difficulty);

    const completeSentences = countCompleteSentences(messages);
    const learnedVocabulary = countLearnedVocabulary(messages);
    const indonesianMessages = countIndonesianMessages(messages);
    const helpSeekingMessages = countHelpSeekingMessages(messages);
    const userTurns = getUserMessages(messages).length;

    return baseGoals.map((goal) => {
      switch (goal.id) {
        case "complete-sentences": {
          const target = goal.target ?? 5;
          return {
            ...goal,
            progress: completeSentences,
            progressLabel: `${completeSentences}/${target} kalimat`,
            achieved: completeSentences >= target,
          };
        }
        case "new-vocabulary": {
          const target = goal.target ?? 3;
          return {
            ...goal,
            progress: learnedVocabulary,
            progressLabel: `${learnedVocabulary}/${target} kosakata`,
            achieved: learnedVocabulary >= target,
          };
        }
        case "english-only":
          return {
            ...goal,
            progress: indonesianMessages,
            progressLabel:
              indonesianMessages === 0
                ? "Tetap gunakan Inggris"
                : `${indonesianMessages} pesan terdeteksi ID`,
            achieved: indonesianMessages === 0 && userTurns > 0,
          };
        case "independent-practice": {
          const target = goal.target ?? 3;
          return {
            ...goal,
            progress: userTurns,
            progressLabel:
              helpSeekingMessages === 0
                ? `${userTurns}/${target} respons mandiri`
                : `${helpSeekingMessages} kali minta bantuan`,
            achieved:
              helpSeekingMessages === 0 && userTurns >= target,
          };
        }
        default:
          return goal;
      }
    });
  }

  evaluateFinal(
    difficulty: string,
    messages: ConversationMessage[],
    metrics: SessionMetrics,
    storedGoals?: SessionGoal[] | null
  ) {
    const evaluated = this.evaluate(difficulty, messages, storedGoals);

    return evaluated.map((goal) => {
      if (goal.id !== "new-vocabulary") {
        return goal;
      }

      const target = goal.target ?? 3;
      const vocabularyProgress = Math.max(goal.progress, metrics.newVocabulary.length);

      return {
        ...goal,
        progress: vocabularyProgress,
        progressLabel: `${vocabularyProgress}/${target} kosakata`,
        achieved: vocabularyProgress >= target,
      };
    });
  }
}

export const goalEvaluatorService = new GoalEvaluatorService();
