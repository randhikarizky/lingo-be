import { billingReturnHandler } from "@/features/billing/presentation/handlers/billing.handler";
import { corsPreflightResponse } from "@/global/utils/cors";
import { wrapDynamicHandler } from "@/global/utils/route-handler";

export const GET = wrapDynamicHandler("GET", billingReturnHandler);

export async function OPTIONS() {
  return corsPreflightResponse();
}
