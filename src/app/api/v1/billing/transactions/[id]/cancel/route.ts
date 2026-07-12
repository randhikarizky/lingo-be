import { billingCancelHandler } from "@/features/billing/presentation/handlers/billing.handler";
import { corsPreflightResponse } from "@/global/utils/cors";
import { wrapDynamicHandler } from "@/global/utils/route-handler";

export const POST = wrapDynamicHandler("POST", billingCancelHandler);

export async function OPTIONS() {
  return corsPreflightResponse();
}
