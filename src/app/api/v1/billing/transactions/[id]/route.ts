import { billingDetailHandler } from "@/features/billing/presentation/handlers/billing.handler";
import { corsPreflightResponse } from "@/global/utils/cors";
import { wrapDynamicHandler } from "@/global/utils/route-handler";

export const GET = wrapDynamicHandler("GET", billingDetailHandler);

export async function OPTIONS() {
  return corsPreflightResponse();
}
