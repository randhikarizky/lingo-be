import { createRouteHandler } from "@/global/utils/route-handler";
import { subscriptionPlansHandler } from "@/features/subscription/presentation/handlers/subscription.handler";

export const { GET, OPTIONS } = createRouteHandler({
  GET: subscriptionPlansHandler,
});
