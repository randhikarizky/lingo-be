const DEFAULT_TRANSCRIPT =
  "Hello, I would like to practice my English speaking skills today.";

const TRANSCRIPTS_BY_LANGUAGE: Record<string, string> = {
  "en-US": DEFAULT_TRANSCRIPT,
  "en-GB": "Hello, I'd like to practise my English speaking today.",
  "id-ID":
    "Halo, saya ingin berlatih berbicara bahasa Inggris hari ini.",
};

export const MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024;

export function getMockTranscript(language?: string): string {
  if (!language) {
    return DEFAULT_TRANSCRIPT;
  }

  const normalized = language.trim();
  return TRANSCRIPTS_BY_LANGUAGE[normalized] ?? DEFAULT_TRANSCRIPT;
}
