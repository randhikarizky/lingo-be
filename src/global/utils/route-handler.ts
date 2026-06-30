import { corsPreflightResponse } from "./cors";
import { logError, logInfo } from "@/global/utils/logger";
import { attachRequestId, getRequestId } from "@/global/utils/request-id";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (request: Request, ...args: any[]) => Promise<Response> | Response;

function wrapHandler(method: string, handler: RouteHandler): RouteHandler {
  return async (request: Request, ...args: unknown[]) => {
    const requestId = getRequestId(request);
    const path = new URL(request.url).pathname;
    const started = Date.now();

    try {
      const response = await handler(request, ...args);

      logInfo(requestId, "api.completed", {
        method,
        path,
        status: response.status,
        durationMs: Date.now() - started,
      });

      if (!response.headers.has("X-Request-Id")) {
        return attachRequestId(response, requestId);
      }

      return response;
    } catch (error) {
      logError(requestId, "api.failed", {
        method,
        path,
        durationMs: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}

export function createRouteHandler(handlers: {
  GET?: RouteHandler;
  POST?: RouteHandler;
  PUT?: RouteHandler;
  PATCH?: RouteHandler;
  DELETE?: RouteHandler;
}) {
  const wrapped: Record<string, RouteHandler | (() => Response)> = {
    OPTIONS: () => corsPreflightResponse(),
  };

  for (const [method, handler] of Object.entries(handlers)) {
    if (handler) {
      wrapped[method] = wrapHandler(method, handler);
    }
  }

  return wrapped as typeof handlers & { OPTIONS: () => Response };
}

export function wrapDynamicHandler(method: string, handler: RouteHandler): RouteHandler {
  return wrapHandler(method, handler);
}
