export type BillingAnalyticsEvent =
  | "payment_created"
  | "payment_success"
  | "payment_failed"
  | "payment_expired"
  | "subscription_activated";

export function logBillingAnalyticsEvent(
  event: BillingAnalyticsEvent,
  payload: Record<string, unknown>,
) {
  console.info(`[analytics] ${event}`, payload);
}
