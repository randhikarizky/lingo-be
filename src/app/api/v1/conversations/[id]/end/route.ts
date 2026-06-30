import { endSessionHandler } from "@/features/learning/presentation/handlers/end-session.handler";
import { corsPreflightResponse } from "@/global/utils/cors";
import { wrapDynamicHandler } from "@/global/utils/route-handler";

export const POST = wrapDynamicHandler("POST", endSessionHandler);

export async function OPTIONS() {
  return corsPreflightResponse();
}
