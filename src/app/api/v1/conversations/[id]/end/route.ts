import { corsPreflightResponse } from "@/global/utils/cors";
import { endSessionHandler } from "@/features/learning/presentation/handlers/end-session.handler";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return endSessionHandler(request, context);
}

export async function OPTIONS() {
  return corsPreflightResponse();
}
