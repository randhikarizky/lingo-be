export type SessionMetrics = {
  wordsSpoken: number;
  corrections: number;
  newVocabulary: string[];
  estimatedSpeakingMinutes: number;
};

export type SessionSummaryFeedback = {
  grammar: string;
  vocabulary: string;
  fluency: string;
  confidence: string;
  strength: string;
  improvementArea: string;
};

export type LearningSessionMetadata = {
  characterId: string;
  personality: string;
  scenarioType: string;
  difficulty: string;
  objective: string;
  language: string;
};
