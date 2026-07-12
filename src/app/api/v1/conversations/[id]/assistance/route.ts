import {
  assistanceHandler,
  getAssistanceHandler,
} from "@/features/learning/presentation/handlers/assistance.handler";
import { corsPreflightResponse } from "@/global/utils/cors";
import { wrapDynamicHandler } from "@/global/utils/route-handler";

export const GET = wrapDynamicHandler("GET", getAssistanceHandler);
export const POST = wrapDynamicHandler("POST", assistanceHandler);

export async function OPTIONS() {
  return corsPreflightResponse();
}
