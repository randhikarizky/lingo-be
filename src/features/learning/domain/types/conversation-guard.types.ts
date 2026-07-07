export type ConversationGuardCategory =
  | "ROLEPLAY"
  | "LEARNING"
  | "META"
  | "OFF_TOPIC";

export type ConversationGuardResult = {
  allowAI: boolean;
  category: ConversationGuardCategory;
  redirectMessage?: string;
};

export type ConversationGuardState = {
  focusScore: number;
  redirectCount: number;
};
