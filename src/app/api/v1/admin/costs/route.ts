import { createRouteHandler } from "@/global/utils/route-handler";
import { adminCostReviewHandler } from "@/features/admin/presentation/handlers/metrics.handler";

export const { GET, OPTIONS } = createRouteHandler({
  GET: adminCostReviewHandler,
});
