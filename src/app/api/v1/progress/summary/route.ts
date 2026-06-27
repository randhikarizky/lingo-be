import { createRouteHandler } from "@/global/utils/route-handler";
import { progressSummaryHandler } from "@/features/progress/presentation/handlers/summary.handler";

export const { GET, OPTIONS } = createRouteHandler({
  GET: progressSummaryHandler,
});
