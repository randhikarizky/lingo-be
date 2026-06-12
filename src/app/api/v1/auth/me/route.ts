import { meHandler } from "@/features/auth/presentation/handlers/me.handler";
import { createRouteHandler } from "@/global/utils/route-handler";

export const { GET, OPTIONS } = createRouteHandler({
  GET: meHandler,
});
