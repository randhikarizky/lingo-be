export type DifficultyId = "beginner" | "intermediate" | "advanced";

export type DifficultyDefinition = {
  id: DifficultyId;
  label: string;
  grammarLevel: string;
  responseLength: string;
  speechPace: string;
  vocabularyRange: string;
};

export const DIFFICULTIES: DifficultyDefinition[] = [
  {
    id: "beginner",
    label: "Beginner",
    grammarLevel: "Use simple present, past, and future tenses with short sentences.",
    responseLength: "Keep replies to 1-3 short sentences.",
    speechPace: "Speak slowly and clearly; pause between ideas.",
    vocabularyRange: "Use high-frequency everyday words only.",
  },
  {
    id: "intermediate",
    label: "Intermediate",
    grammarLevel: "Use mixed tenses, comparatives, and common phrasal verbs naturally.",
    responseLength: "Keep replies to 2-4 sentences with one follow-up question.",
    speechPace: "Use a natural conversational pace.",
    vocabularyRange: "Introduce useful topic vocabulary with brief context.",
  },
  {
    id: "advanced",
    label: "Advanced",
    grammarLevel: "Use complex clauses, conditionals, and nuanced grammar naturally.",
    responseLength: "Use richer responses (3-5 sentences) with subtle feedback.",
    speechPace: "Use native-like pacing and idiomatic expressions.",
    vocabularyRange: "Use precise, idiomatic, and domain-specific vocabulary.",
  },
];

export function getDifficulty(id: string): DifficultyDefinition {
  return DIFFICULTIES.find((item) => item.id === id) ?? DIFFICULTIES[0];
}

export function isValidDifficulty(id: string): id is DifficultyId {
  return DIFFICULTIES.some((item) => item.id === id);
}
