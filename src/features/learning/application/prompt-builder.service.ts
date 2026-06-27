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
