import { corsPreflightResponse } from "./cors";

export function createRouteHandler(handlers: {
  GET?: () => Promise<Response> | Response;
  POST?: (request: Request) => Promise<Response> | Response;
  PUT?: (request: Request) => Promise<Response> | Response;
  PATCH?: (request: Request) => Promise<Response> | Response;
  DELETE?: (request: Request) => Promise<Response> | Response;
}) {
  return {
    OPTIONS: () => corsPreflightResponse(),
    ...handlers,
  };
}
