import {
  getDifficulty,
  type DifficultyId,
} from "@/features/learning/domain/constants/difficulties";
import { getScenario } from "@/features/learning/domain/constants/scenarios";
import type { LearningSessionMetadata } from "@/features/learning/domain/types/learning-session.types";
import type {
  ConversationGuardCategory,
  ConversationGuardResult,
  ConversationGuardState,
} from "@/features/learning/domain/types/conversation-guard.types";

const META_LEARNING_PATTERNS = [
  /\b(speak|talk)\s+slower\b/i,
  /\b(lebih\s+pelan|pelan\s+dikit|slow\s+down)\b/i,
  /\b(explain|jelaskan)\s+(in|pakai|gunakan|with)\s+(indonesia|indonesian|bahasa indonesia)\b/i,
  /\b(bahasa indonesia|in indonesian)\s+(aja|only|please|dulu|ya)?\b/i,
  /\b(repeat|ulangi)(\s+(please|dong|lagi))?\b/i,
  /\b(use|pakai)\s+(easier|simpler|lebih mudah)\s+(vocabulary|words|kosakata)\b/i,
  /\b(easier|lebih mudah)\s+(vocabulary|words|kosakata)\b/i,
  /\bcorrect\s+(every|each)\s+mistake\b/i,
  /\bkoreksi\s+(setiap|semua)\s+(kesalahan|mistake)\b/i,
  /\bdon'?t\s+interrupt\b/i,
  /\bjangan\s+(potong|interupsi)\b/i,
];

const LEARNING_INTENT_PATTERNS = [
  /\bwhat does .+ mean\b/i,
  /\b(apa arti|arti dari|maksudnya|meaning of)\b/i,
  /\bdifference between\b/i,
  /\b(perbedaan|beda)\s+(antara|between)\b/i,
  /\b(explain|jelaskan)\s+(this|grammar|the|why|sentence|tense|rule)\b/i,
  /\bwhy is (this|the|my) sentence\b/i,
  /\bhow (do i|to|should i) pronounce\b/i,
  /\b(cara pengucapan|how do you say|how to say)\b/i,
  /\b(is this|is my|am i)\s+(correct|wrong|grammar|sentence)\b/i,
  /\b(what('s| is) the (difference|grammar|rule))\b/i,
  /\b(translate|terjemah|translation)\b/i,
];

const OFF_TOPIC_PATTERNS = [
  /\d+\s*[\+\-\*×÷/]\s*\d+/,
  /\b\d+\s*(plus|tambah|\+|minus|kurang|kali|dibagi)\s*\d+\b/i,
  /\b(berapa|what is|what's)\s+(hasil|jawaban|sama dengan|equal to)\b/i,
  /^\s*[\d\s+\-*/().=,?]+\?\s*$/,
  /\b(messi|ronaldo|mbappe|football trivia)\b/i,
  /\b(kamu|lu|elo|kau)\s+(bisa|bisa ga|bisa gak|boleh)\s+(berenang|menyanyi|makan|tidur|pacaran|nikah|main game|nonton)/i,
  /\b(can|do)\s+you\s+(swim|eat|sleep|date|marry|have a body|feel|love me)\b/i,
  /\b(do you have|are you)\s+(a body|feelings|emotions|real|human|boyfriend|girlfriend)\b/i,
  /\b(siapa\s+(presiden|artis|menteri)|who is (the )?president)\b/i,
  /\b(ibu kota|capital of)\s+\w+/i,
  /\b(cuaca|weather)\s+(hari ini|today|besok|tomorrow)\b/i,
  /\b(buatkan|write|generate)\s+(kode|code|javascript|python|essay|cerita|story)\b/i,
  /\b(javascript|python|typescript)\s+code\b/i,
  /\b(harga bitcoin|crypto|saham|stock price)\b/i,
  /\b(tell me a joke|ceritakan lelucon|make me laugh)\b/i,
  /\b(resep masakan|recipe for)\b/i,
  /\b(password|passwordnya|kata sandi)\s+(wifi|wi-fi|internet)\b/i,
  /\b(apa|what\s+is)\s+(password|passwordnya|kata sandi)\b/i,
  /\b(warna favorit|favorite color)\b/i,
  /\b(ceritakan tentang|tell me about)\s+(perang|world war)\b/i,
  /\b(perang dunia|world war)\b/i,
  /\b(buatkan|buat|make)\s+(website|situs|aplikasi|app)\b/i,
];

const SCENARIO_CONTINUE_PROMPTS: Record<string, string> = {
  restaurant: "What would you like to order?",
  cafe: "What can I get started for you today?",
  shopping: "Can I help you find a size?",
  hotel: "How can I help you with your check-in?",
  airport: "May I see your passport, please?",
  immigration: "What is the purpose of your visit?",
  taxi: "Where would you like to go?",
  "train-station": "Which destination are you traveling to?",
  meeting: "Shall we start with your update?",
  interview: "Tell me about your experience.",
  doctor: "What symptoms have you been having?",
  pharmacy: "How can I help you with your prescription?",
};

const DIFFICULTY_REDIRECT: Record<
  DifficultyId,
  (continuePrompt: string) => string
> = {
  beginner: (continuePrompt) =>
    [
      "Aku ingin tetap fokus membantu latihan bahasa.",
      "",
      "Yuk lanjutkan latihanmu 😊",
      "",
      continuePrompt,
    ].join("\n"),
  intermediate: (continuePrompt) =>
    [
      "Mari kita kembali ke latihan bahasa.",
      "",
      "Coba ajukan pertanyaan dalam bahasa Inggris sesuai skenario saat ini.",
      "",
      continuePrompt,
    ].join("\n"),
  advanced: (continuePrompt) =>
    [
      "Let's stay focused on your English practice.",
      "",
      "Try asking something related to the current conversation.",
      "",
      continuePrompt,
    ].join("\n"),
};

const REPEATED_REDIRECT_BY_DIFFICULTY: Record<
  DifficultyId,
  (continuePrompt: string) => string
> = {
  beginner: (continuePrompt) =>
    [
      "😊 Kita sudah beberapa kali keluar topik.",
      "",
      "Agar latihan hari ini selesai, ayo kita kembali ke misi.",
      "",
      continuePrompt,
    ].join("\n"),
  intermediate: (continuePrompt) =>
    [
      "Kita sudah beberapa kali keluar dari latihan.",
      "",
      "Mari fokus kembali ke skenario saat ini.",
      "",
      continuePrompt,
    ].join("\n"),
  advanced: (continuePrompt) =>
    [
      "We've gone off-topic a few times.",
      "",
      "Let's get back to your practice session.",
      "",
      continuePrompt,
    ].join("\n"),
};

function resolveDifficultyId(difficulty: string): DifficultyId {
  const resolved = getDifficulty(difficulty).id;
  return resolved;
}

function normalizeMessage(content: string) {
  return content.trim().replace(/\s+/g, " ");
}

export function applyFocusUpdate(
  state: ConversationGuardState,
  category: ConversationGuardCategory,
): ConversationGuardState {
  if (category === "OFF_TOPIC") {
    return {
      focusScore: Math.max(0, state.focusScore - 5),
      redirectCount: state.redirectCount + 1,
    };
  }

  if (category === "ROLEPLAY") {
    return {
      focusScore: Math.min(100, state.focusScore + 1),
      redirectCount: state.redirectCount,
    };
  }

  return state;
}

export class ConversationGuardService {
  classify(content: string): ConversationGuardCategory {
    const message = normalizeMessage(content);
    if (!message) {
      return "ROLEPLAY";
    }

    if (META_LEARNING_PATTERNS.some((pattern) => pattern.test(message))) {
      return "META";
    }

    if (LEARNING_INTENT_PATTERNS.some((pattern) => pattern.test(message))) {
      return "LEARNING";
    }

    if (OFF_TOPIC_PATTERNS.some((pattern) => pattern.test(message))) {
      return "OFF_TOPIC";
    }

    return "ROLEPLAY";
  }

  resolveContinuePrompt(scenarioType: string) {
    return (
      SCENARIO_CONTINUE_PROMPTS[scenarioType] ?? "How can I help you today?"
    );
  }

  buildRedirectMessage(
    metadata: LearningSessionMetadata,
    redirectCount: number,
  ) {
    const scenario = getScenario(metadata.scenarioType);
    const continuePrompt = this.resolveContinuePrompt(scenario.id);
    const difficultyId = resolveDifficultyId(metadata.difficulty);

    if (redirectCount >= 3) {
      return REPEATED_REDIRECT_BY_DIFFICULTY[difficultyId](continuePrompt);
    }

    return DIFFICULTY_REDIRECT[difficultyId](continuePrompt);
  }

  evaluate(
    content: string,
    metadata: LearningSessionMetadata,
    state: ConversationGuardState,
  ): {
    result: ConversationGuardResult;
    nextState: ConversationGuardState;
  } {
    const category = this.classify(content);
    const nextState = applyFocusUpdate(state, category);

    if (category === "OFF_TOPIC") {
      return {
        result: {
          allowAI: false,
          category,
          redirectMessage: this.buildRedirectMessage(
            metadata,
            nextState.redirectCount,
          ),
        },
        nextState,
      };
    }

    return {
      result: {
        allowAI: true,
        category,
      },
      nextState,
    };
  }
}

export const conversationGuardService = new ConversationGuardService();
