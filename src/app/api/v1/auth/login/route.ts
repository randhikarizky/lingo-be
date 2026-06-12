import { loginHandler } from "@/features/auth/presentation/handlers/login.handler";
import { createRouteHandler } from "@/global/utils/route-handler";

export const { POST, OPTIONS } = createRouteHandler({
  POST: loginHandler,
});
