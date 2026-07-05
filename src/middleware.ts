import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  applyRateLimit,
  getClientIp,
  resolveRateLimitPolicy,
} from "@/global/middleware/rate-limit";
import { resolveCorsOrigin } from "@/global/utils/cors";

function applyCorsHeaders(response: NextResponse, origin: string) {
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Vary", "Origin");
  return response;
}

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const origin = resolveCorsOrigin(request);

  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 });
    applyCorsHeaders(response, origin);
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Request-Id, X-Admin-Key",
    );
    response.headers.set("Access-Control-Max-Age", "86400");
    return response;
  }

  const policy = resolveRateLimitPolicy(request.nextUrl.pathname);

  if (policy) {
    const ip = getClientIp(request);
    const limited = applyRateLimit(`${policy}:${ip}`, policy);

    if (!limited.allowed) {
      const response = NextResponse.json(
        {
          success: false,
          message: "Terlalu banyak permintaan. Coba lagi nanti.",
          data: null,
        },
        { status: 429 },
      );
      response.headers.set("Retry-After", String(limited.retryAfterSeconds));
      return applyCorsHeaders(response, origin);
    }
  }

  const response = NextResponse.next();
  return applyCorsHeaders(response, origin);
}

export const config = {
  matcher: "/api/:path*",
};
