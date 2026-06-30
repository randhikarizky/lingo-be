import { localFileHandler } from "@/features/storage/presentation/handlers/local-file.handler";
import { corsPreflightResponse } from "@/global/utils/cors";
import { wrapDynamicHandler } from "@/global/utils/route-handler";

export const GET = wrapDynamicHandler("GET", localFileHandler);

export async function OPTIONS() {
  return corsPreflightResponse();
}
