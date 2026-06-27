import { randomUUID } from "crypto";

const REQUEST_ID_HEADER = "x-request-id";

export function createRequestId() {
  return randomUUID();
}

export function getRequestId(request?: Request | null) {
  const incoming = request?.headers.get(REQUEST_ID_HEADER)?.trim();
  return incoming && incoming.length > 0 ? incoming : createRequestId();
}

export function attachRequestId(response: Response, requestId: string) {
  response.headers.set("X-Request-Id", requestId);
  return response;
}
