import type { ConversationGuardCategory } from "@/features/learning/domain/types/conversation-guard.types";

export type ConversationGuardAnalyticsEvent =
  | "conversation_guard_allowed"
  | "conversation_guard_redirected"
  | "conversation_guard_learning"
  | "conversation_guard_meta"
  | "blocked_topic"
  | "conversation_guard_error";

const CATEGORY_EVENT_MAP: Record<
  ConversationGuardCategory,
  ConversationGuardAnalyticsEvent
> = {
  ROLEPLAY: "conversation_guard_allowed",
  LEARNING: "conversation_guard_learning",
  META: "conversation_guard_meta",
  OFF_TOPIC: "blocked_topic",
};

export type ConversationGuardAnalyticsPayload = {
  userId: string;
  conversationId: string;
  category: ConversationGuardCategory;
  focusScore: number;
  redirectCount: number;
  timestamp: string;
};

export function logConversationGuardEvent(
  category: ConversationGuardCategory,
  payload: {
    userId: string;
    conversationId: string;
    focusScore: number;
    redirectCount: number;
  },
) {
  const event = CATEGORY_EVENT_MAP[category];
  const record: ConversationGuardAnalyticsPayload = {
    ...payload,
    category,
    timestamp: new Date().toISOString(),
  };

  console.info(`[analytics] ${event}`, record);
}

export function logConversationGuardFailure(payload: {
  userId: string;
  conversationId: string;
  error: string;
}) {
  console.warn("[analytics] conversation_guard_error", {
    ...payload,
    timestamp: new Date().toISOString(),
  });
}
