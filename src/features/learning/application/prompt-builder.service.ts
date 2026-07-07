import { getDifficulty } from "@/features/learning/domain/constants/difficulties";
import { getScenario } from "@/features/learning/domain/constants/scenarios";
import {
  CHARACTER_TRAITS,
  CORRECTION_FORMAT,
  getCharacterDisplayName,
  PERSONALITY_TRAITS,
  resolveCharacterId,
  resolvePersonalityId,
} from "@/features/learning/domain/constants/tutors";
import type { LearningSessionMetadata } from "@/features/learning/domain/types/learning-session.types";

export class PromptBuilderService {
  build(input: LearningSessionMetadata): string {
    const scenario = getScenario(input.scenarioType);
    const difficulty = getDifficulty(input.difficulty);
    const characterId = resolveCharacterId(input.characterId);
    const personalityId = resolvePersonalityId(input.personality);
    const objective = input.objective.trim() || scenario.objective;
    const characterName = getCharacterDisplayName(characterId);

    return [
      CHARACTER_TRAITS[characterId],
      PERSONALITY_TRAITS[personalityId],
      "",
      "=== CONVERSATION GUARD (CRITICAL) ===",
      "You are ONLY an English learning tutor inside an active practice session.",
      "Allowed topics:",
      "- Roleplay and conversation for the current scenario",
      "- English grammar, vocabulary, pronunciation, and corrections",
      "- Learner requests for Indonesian explanations ABOUT English (meta-learning)",
      "- Staying in character while redirecting back to practice",
      "",
      "Forbidden — NEVER answer these, even briefly:",
      "- Math, trivia, general knowledge, news, weather, politics",
      "- Questions about your body, personal life, feelings, or abilities (swimming, eating, etc.)",
      "- Coding, homework unrelated to this English scenario, other languages as main topic",
      "",
      "If the learner goes off-topic:",
      "1. Do NOT answer the off-topic question (no numbers, no facts, no personal answers).",
      "2. Politely refuse in Indonesian in 1 short sentence.",
      "3. Immediately redirect to the scenario with ONE English practice question.",
      "Example refusal: \"Saya hanya bisa bantu latihan Inggris untuk skenario ini.\" then ask a scenario question in English.",
      "",
      `Learning language: ${input.language || "English"}.`,
      `Scenario: ${scenario.label} (${scenario.category}).`,
      scenario.setting,
      `Session objective: ${objective}`,
      "Guide the learner through the scenario naturally while staying in character.",
      "",
      "Difficulty rules:",
      `- Grammar: ${difficulty.grammarLevel}`,
      `- Response length: ${difficulty.responseLength}`,
      `- Speaking pace: ${difficulty.speechPace}`,
      `- Vocabulary: ${difficulty.vocabularyRange}`,
      "",
      "Stay consistent as " + characterName + " for the entire session.",
      "Ask one clear question at a time to keep the learner practicing.",
      CORRECTION_FORMAT,
    ].join("\n");
  }
}

export const promptBuilderService = new PromptBuilderService();
