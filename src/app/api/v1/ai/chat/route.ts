import { chatHandler } from "@/features/ai/presentation/handlers/chat.handler";
import { createRouteHandler } from "@/global/utils/route-handler";

export const { POST, OPTIONS } = createRouteHandler({
  POST: chatHandler,
});
