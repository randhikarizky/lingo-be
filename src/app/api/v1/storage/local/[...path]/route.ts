import { localFileHandler } from "@/features/storage/presentation/handlers/local-file.handler";
import { corsPreflightResponse } from "@/global/utils/cors";

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  return localFileHandler(request, context);
}

export async function OPTIONS() {
  return corsPreflightResponse();
}
