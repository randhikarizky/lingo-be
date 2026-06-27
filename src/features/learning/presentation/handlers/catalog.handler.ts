import { DIFFICULTIES } from "@/features/learning/domain/constants/difficulties";
import { getScenariosByCategory } from "@/features/learning/domain/constants/scenarios";
import { getSessionGoalPreviews } from "@/features/learning/domain/constants/session-goals";
import { successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";

export async function learningCatalogHandler() {
  return withCors(
    successResponse({
      scenarios: getScenariosByCategory(),
      difficulties: DIFFICULTIES.map(({ id, label }) => ({ id, label })),
      sessionGoalPreviews: getSessionGoalPreviews(),
    })
  );
}
