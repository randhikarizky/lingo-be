import { logoutHandler } from "@/features/auth/presentation/handlers/logout.handler";
import { createRouteHandler } from "@/global/utils/route-handler";

export const { POST, OPTIONS } = createRouteHandler({
  POST: logoutHandler,
});
