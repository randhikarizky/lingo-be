import { NextResponse } from "next/server";

function getAllowedOrigins() {
  const raw = process.env.FRONTEND_URL ?? "http://localhost:3626";
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isLocalhostOrigin(origin: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

export function resolveCorsOrigin(request?: Request | null) {
  const allowed = getAllowedOrigins();
  const origin = request?.headers.get("Origin");

  if (origin) {
    if (allowed.includes(origin)) return origin;
    if (process.env.NODE_ENV !== "production" && isLocalhostOrigin(origin)) {
      return origin;
    }
  }

  return allowed[0] ?? "http://localhost:3626";
}

export function withCors(
  response: NextResponse | Response,
  request?: Request | null,
) {
  const origin = resolveCorsOrigin(request);

  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Vary", "Origin");
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );
  return response;
}

export function corsPreflightResponse(request?: Request | null) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}
