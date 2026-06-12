import { registerHandler } from "@/features/auth/presentation/handlers/register.handler";
import { createRouteHandler } from "@/global/utils/route-handler";

export const { POST, OPTIONS } = createRouteHandler({
  POST: registerHandler,
});
