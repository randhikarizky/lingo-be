import { attachRequestId, getRequestId } from "@/global/utils/request-id";
import { errorResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";

export type ApiErrorCode =
  | "NETWORK_TIMEOUT"
  | "AI_PROVIDER_ERROR"
  | "VOICE_PROVIDER_ERROR"
  | "QUOTA_EXCEEDED"
  | "RATE_LIMITED"
  | "UNAUTHORIZED"
  | "VALIDATION_ERROR"
  | "SERVER_ERROR"
  | "SERVICE_UNAVAILABLE";

export type ApiErrorPayload = {
  errorCode: ApiErrorCode;
  requestId: string;
};

export function mapHttpStatusToErrorCode(status: number): ApiErrorCode {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 408 || status === 504) return "NETWORK_TIMEOUT";
  if (status === 429) return "RATE_LIMITED";
  if (status === 503) return "SERVICE_UNAVAILABLE";
  if (status >= 500) return "SERVER_ERROR";
  return "VALIDATION_ERROR";
}

export function inferErrorCodeFromMessage(message: string): ApiErrorCode {
  const lower = message.toLowerCase();
  if (lower.includes("timeout")) return "NETWORK_TIMEOUT";
  if (lower.includes("kie ai") || lower.includes("provider")) return "AI_PROVIDER_ERROR";
  if (lower.includes("transkripsi") || lower.includes("tts") || lower.includes("voice")) {
    return "VOICE_PROVIDER_ERROR";
  }
  return "SERVER_ERROR";
}

export function apiErrorResponse(
  request: Request,
  message: string,
  status: number,
  errorCode?: ApiErrorCode
) {
  const requestId = getRequestId(request);
  const code = errorCode ?? mapHttpStatusToErrorCode(status);

  return withCors(
    attachRequestId(
      errorResponse(message, status, {
        errorCode: code,
        requestId,
      }),
      requestId
    ),
    request
  );
}
