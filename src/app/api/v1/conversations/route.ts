import { createRouteHandler } from "@/global/utils/route-handler";
import { createConversationHandler } from "@/features/conversation/presentation/handlers/create.handler";
import { listConversationsHandler } from "@/features/conversation/presentation/handlers/list.handler";

export const { POST, GET, OPTIONS } = createRouteHandler({
  POST: createConversationHandler,
  GET: listConversationsHandler,
});
