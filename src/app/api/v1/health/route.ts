import { getMockStatus } from "@/global/config/mock.config";
import { successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";
import { createRouteHandler } from "@/global/utils/route-handler";

export const { GET, OPTIONS } = createRouteHandler({
  GET: async () =>
    withCors(
      successResponse({
        status: "ok",
        service: "lingora-be",
        timestamp: new Date().toISOString(),
        mock: getMockStatus(),
      }),
    ),
});
