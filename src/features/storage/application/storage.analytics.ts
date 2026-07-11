export type StorageAnalyticsEvent =
  | "storage_upload"
  | "storage_delete"
  | "storage_download"
  | "storage_signed_url";

export function logStorageAnalyticsEvent(
  event: StorageAnalyticsEvent,
  payload: Record<string, unknown>,
) {
  console.info(`[analytics] ${event}`, payload);
}
