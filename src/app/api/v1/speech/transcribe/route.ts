import { transcribeHandler } from "@/features/speech/presentation/handlers/transcribe.handler";
import { createRouteHandler } from "@/global/utils/route-handler";

export const { POST, OPTIONS } = createRouteHandler({
  POST: transcribeHandler,
});
