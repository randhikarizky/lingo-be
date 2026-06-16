import { corsPreflightResponse } from "@/global/utils/cors";
import { detailConversationHandler } from "@/features/conversation/presentation/handlers/detail.handler";
import { deleteConversationHandler } from "@/features/conversation/presentation/handlers/delete.handler";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return detailConversationHandler(request, context);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return deleteConversationHandler(request, context);
}

export async function OPTIONS() {
  return corsPreflightResponse();
}
