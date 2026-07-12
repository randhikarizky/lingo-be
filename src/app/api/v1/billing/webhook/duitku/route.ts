import { duitkuWebhookHandler } from "@/features/billing/presentation/handlers/webhook.handler";
import { corsPreflightResponse } from "@/global/utils/cors";
import { wrapDynamicHandler } from "@/global/utils/route-handler";

export const POST = wrapDynamicHandler("POST", duitkuWebhookHandler);

export async function OPTIONS() {
  return corsPreflightResponse();
}
