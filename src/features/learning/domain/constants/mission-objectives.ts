import { getScenario } from "@/features/learning/domain/constants/scenarios";
import type { DifficultyId } from "@/features/learning/domain/constants/difficulties";

export type MissionObjectiveDefinition = {
  id: string;
  label: string;
  goal: string;
  tips: string[];
  difficultyStars: number;
  detectionPatterns: RegExp[];
  hints: Record<DifficultyId, string>;
  examples: string[];
};

const RESTAURANT_OBJECTIVES: MissionObjectiveDefinition[] = [
  {
    id: "greeting",
    label: "Greeting",
    goal: "Sapa pelayan dengan sopan.",
    tips: ["Mulai dengan sapaan singkat seperti Hello atau Good evening."],
    difficultyStars: 1,
    detectionPatterns: [
      /\b(hello|hi|good (morning|afternoon|evening)|hey)\b/i,
      /\b(selamat|halo)\b/i,
    ],
    hints: {
      beginner:
        "Coba sapa pelayan dengan sopan, misalnya: Good evening atau Hello.",
      intermediate:
        "Coba sapa waiter dengan greeting singkat seperti Good evening.",
      advanced: "Try greeting the waiter politely, for example: Good evening.",
    },
    examples: ["Good evening.", "Hello! I'd like a table for one, please."],
  },
  {
    id: "order-drink",
    label: "Order Drink",
    goal: "Pesan minuman.",
    tips: ["Sebutkan minuman yang kamu inginkan dengan jelas."],
    difficultyStars: 2,
    detectionPatterns: [
      /\b(coffee|tea|water|juice|drink|latte|espresso|soda)\b/i,
      /\b(i('d| would) like|can i (have|get)|i'll (have|take))\b/i,
    ],
    hints: {
      beginner: "Coba pesan minuman dengan kalimat sederhana.",
      intermediate: "Coba pesan minuman, misalnya: I'd like a glass of water.",
      advanced: "Try ordering a drink, for example: I'd like a glass of water.",
    },
    examples: ["I'd like a glass of water, please.", "Can I get a coffee?"],
  },
  {
    id: "ask-special",
    label: "Ask Today's Special",
    goal: "Cari tahu menu spesial hari ini.",
    tips: [
      "Pelayan biasanya mengetahui menu yang sedang direkomendasikan.",
    ],
    difficultyStars: 2,
    detectionPatterns: [
      /\b(special|recommend|today'?s|dish of the day)\b/i,
      /\b(apa menu|menu hari ini|spesial)\b/i,
    ],
    hints: {
      beginner:
        "Coba tanyakan kepada pelayan mengenai menu spesial hari ini.",
      intermediate:
        "Coba tanyakan waiter mengenai today's special menu.",
      advanced:
        "Try asking the waiter about today's special dish.",
    },
    examples: [
      "What is today's special?",
      "What do you recommend today?",
    ],
  },
  {
    id: "pay-bill",
    label: "Pay Bill",
    goal: "Minta bon dan selesaikan pembayaran.",
    tips: ["Minta bill/check lalu tanyakan metode pembayaran jika perlu."],
    difficultyStars: 3,
    detectionPatterns: [
      /\b(bill|check|pay|payment|card|cash)\b/i,
      /\b(bayar|bon|tagihan)\b/i,
    ],
    hints: {
      beginner: "Coba minta bon dan tanyakan cara pembayaran.",
      intermediate: "Coba minta the bill dan tanyakan payment by card.",
      advanced: "Try asking for the bill and how you can pay.",
    },
    examples: ["Could I have the bill, please?", "Can I pay by card?"],
  },
];

function buildGenericObjectives(
  scenarioLabel: string,
): MissionObjectiveDefinition[] {
  return [
    {
      id: "start",
      label: "Start Conversation",
      goal: `Mulai percakapan ${scenarioLabel.toLowerCase()} dengan natural.`,
      tips: ["Buka percakapan dengan sapaan singkat."],
      difficultyStars: 1,
      detectionPatterns: [/\b(hello|hi|good|excuse me)\b/i],
      hints: {
        beginner: "Mulai dengan sapaan singkat kepada lawan bicara.",
        intermediate: "Start with a short greeting to open the conversation.",
        advanced: "Open the conversation with a natural greeting.",
      },
      examples: ["Hello!", "Excuse me, I'd like some help."],
    },
    {
      id: "main-task",
      label: "Main Task",
      goal: "Selesaikan tugas utama skenario.",
      tips: ["Fokus pada objective utama misi."],
      difficultyStars: 2,
      detectionPatterns: [/\b(i('d| would) like|can i|could i|please)\b/i],
      hints: {
        beginner: "Coba sampaikan kebutuhanmu dengan kalimat sederhana.",
        intermediate: "State your main request clearly in English.",
        advanced: "Clearly state what you need for this scenario.",
      },
      examples: ["I'd like to order, please.", "Could you help me with this?"],
    },
    {
      id: "follow-up",
      label: "Follow-up Question",
      goal: "Ajukan pertanyaan lanjutan.",
      tips: ["Tanyakan detail yang kamu butuhkan."],
      difficultyStars: 2,
      detectionPatterns: [/\b(how much|what about|do you|is there|can you)\b/i],
      hints: {
        beginner: "Ajukan satu pertanyaan lanjutan yang relevan.",
        intermediate: "Ask one follow-up question about the situation.",
        advanced: "Ask a relevant follow-up question to move forward.",
      },
      examples: ["How much is this?", "Do you have any recommendations?"],
    },
    {
      id: "wrap-up",
      label: "Wrap Up",
      goal: "Tutup percakapan dengan sopan.",
      tips: ["Ucapkan terima kasih sebelum mengakhiri."],
      difficultyStars: 1,
      detectionPatterns: [/\b(thank you|thanks|that's all|goodbye|bye)\b/i],
      hints: {
        beginner: "Akhiri dengan mengucapkan terima kasih.",
        intermediate: "Wrap up politely with thank you.",
        advanced: "Close the conversation politely with thanks.",
      },
      examples: ["Thank you!", "That's all for today. Thank you."],
    },
  ];
}

export function getMissionObjectiveDefinitions(
  scenarioType: string,
): MissionObjectiveDefinition[] {
  if (scenarioType === "restaurant") {
    return RESTAURANT_OBJECTIVES;
  }

  const scenario = getScenario(scenarioType);
  return buildGenericObjectives(scenario.label);
}
