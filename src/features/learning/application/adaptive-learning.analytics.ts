export type AssistanceAnalyticsEvent =
  | "hint_opened"
  | "hint_used"
  | "example_opened"
  | "objective_tooltip_opened"
  | "mission_stuck"
  | "mission_completed_without_hint";

export function logAssistanceAnalyticsEvent(
  event: AssistanceAnalyticsEvent,
  payload: Record<string, unknown>,
) {
  console.info(`[analytics] ${event}`, payload);
}
