import { synthesizeHandler } from "@/features/speech/presentation/handlers/synthesize.handler";
import { createRouteHandler } from "@/global/utils/route-handler";

export const { POST, OPTIONS } = createRouteHandler({
  POST: synthesizeHandler,
});
