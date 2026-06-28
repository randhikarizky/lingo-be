import { createRouteHandler } from "@/global/utils/route-handler";
import { subscriptionUpgradeHandler } from "@/features/subscription/presentation/handlers/subscription.handler";

export const { POST, OPTIONS } = createRouteHandler({
  POST: subscriptionUpgradeHandler,
});
