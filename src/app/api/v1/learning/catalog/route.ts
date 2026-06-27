import { corsPreflightResponse } from "@/global/utils/cors";
import { learningCatalogHandler } from "@/features/learning/presentation/handlers/catalog.handler";

export async function GET() {
  return learningCatalogHandler();
}

export async function OPTIONS() {
  return corsPreflightResponse();
}
