import { detailConversationHandler } from "@/features/conversation/presentation/handlers/detail.handler";
import { deleteConversationHandler } from "@/features/conversation/presentation/handlers/delete.handler";
import { corsPreflightResponse } from "@/global/utils/cors";
import { wrapDynamicHandler } from "@/global/utils/route-handler";

export const GET = wrapDynamicHandler("GET", detailConversationHandler);
export const DELETE = wrapDynamicHandler("DELETE", deleteConversationHandler);

export async function OPTIONS() {
  return corsPreflightResponse();
}
