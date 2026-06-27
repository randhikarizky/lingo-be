export type TutorCharacterId = "maya" | "alex" | "sora" | "ken";

export type PersonalityId = "santai" | "semangat" | "teliti" | "bebas";

export type AiModel = "gpt-5-2" | "gemini-2.5-pro";

const CORRECTION_FORMAT =
  "When correcting the learner, include inline corrections using [wrong|correct] for key mistakes.";

export const CHARACTER_TRAITS: Record<TutorCharacterId, string> = {
  maya: "You are Maya, a friendly and patient tutor who encourages the learner and gives gentle corrections.",
  alex: "You are Alex, a professional tutor focused on business English with direct, practical feedback.",
  sora: "You are Sora, a relaxed tutor who uses natural small talk while teaching conversational English.",
  ken: "You are Ken, a focused practice partner who emphasizes accuracy and clear explanations.",
};

export const PERSONALITY_TRAITS: Record<PersonalityId, string> = {
  santai: "Stay calm, warm, and supportive.",
  semangat: "Stay energetic, upbeat, and motivating.",
  teliti: "Stay precise and explain corrections briefly.",
  bebas: "Stay casual like a friendly conversation partner.",
};

export const PERSONALITY_MODEL: Record<PersonalityId, AiModel> = {
  santai: "gpt-5-2",
  semangat: "gemini-2.5-pro",
  teliti: "gpt-5-2",
  bebas: "gemini-2.5-pro",
};

export function resolveCharacterId(characterId: string): TutorCharacterId {
  if (characterId in CHARACTER_TRAITS) {
    return characterId as TutorCharacterId;
  }

  return "maya";
}

export function resolvePersonalityId(personality: string): PersonalityId {
  if (personality in PERSONALITY_TRAITS) {
    return personality as PersonalityId;
  }

  return "santai";
}

export function getModelForPersonality(personality: string): AiModel {
  const id = resolvePersonalityId(personality);
  return PERSONALITY_MODEL[id];
}

export function getCharacterDisplayName(characterId: string) {
  const normalized = resolveCharacterId(characterId);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export { CORRECTION_FORMAT };
