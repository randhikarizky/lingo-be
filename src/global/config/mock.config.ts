const PLACEHOLDER_VALUES = new Set([
  "",
  "your-kie-ai-api-key",
  "your-access-key",
  "your-secret-key",
  "your-bucket-name",
]);

function isPlaceholder(value: string | undefined) {
  return PLACEHOLDER_VALUES.has((value ?? "").trim());
}

export function isMockAiEnabled() {
  if (process.env.MOCK_AI === "true") return true;
  if (process.env.MOCK_AI === "false") return false;
  return isPlaceholder(process.env.KIE_AI_API_KEY);
}

export function isMockStorageEnabled() {
  if (process.env.MOCK_STORAGE === "true") return true;
  if (process.env.MOCK_STORAGE === "false") return false;

  return (
    isPlaceholder(process.env.AWS_ACCESS_KEY_ID) ||
    isPlaceholder(process.env.AWS_SECRET_ACCESS_KEY) ||
    isPlaceholder(process.env.AWS_S3_BUCKET)
  );
}

export function getMockStatus() {
  return {
    ai: isMockAiEnabled(),
    storage: isMockStorageEnabled(),
  };
}
