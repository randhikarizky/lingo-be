import { getMockStatus } from "@/global/config/mock.config";
import { prisma } from "@/global/database/prisma";
import { successResponse, errorResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";
import { createRouteHandler } from "@/global/utils/route-handler";

export const { GET, OPTIONS } = createRouteHandler({
  GET: async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;

      return withCors(
        successResponse({
          status: "ready",
          service: "lingora-be",
          timestamp: new Date().toISOString(),
          mock: getMockStatus(),
          checks: {
            database: "ok",
          },
        })
      );
    } catch {
      return withCors(
        errorResponse("Service not ready", 503, {
          status: "not_ready",
          checks: {
            database: "failed",
          },
        })
      );
    }
  },
});
