import { createRouteHandler } from "@/global/utils/route-handler";
import { progressActivityHandler } from "@/features/progress/presentation/handlers/activity.handler";

export const { GET, OPTIONS } = createRouteHandler({
  GET: progressActivityHandler,
});
