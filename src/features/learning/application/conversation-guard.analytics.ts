import type { ConversationGuardCategory } from "@/features/learning/domain/types/conversation-guard.types";

export type ConversationGuardAnalyticsEvent =
  | "conversation_guard_allowed"
  | "conversation_guard_redirected"
  | "conversation_guard_learning"
  | "conversation_guard_meta";

const CATEGORY_EVENT_MAP: Record<
  ConversationGuardCategory,
  ConversationGuardAnalyticsEvent
> = {
  ROLEPLAY: "conversation_guard_allowed",
  LEARNING: "conversation_guard_learning",
  META: "conversation_guard_meta",
  OFF_TOPIC: "conversation_guard_redirected",
};

export function logConversationGuardEvent(
  category: ConversationGuardCategory,
  payload: {
    conversationId: string;
    focusScore: number;
    redirectCount: number;
  },
) {
  const event = CATEGORY_EVENT_MAP[category];
  console.info(`[analytics] ${event}`, payload);
}
