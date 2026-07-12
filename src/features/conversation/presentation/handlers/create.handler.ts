import { z } from "zod";
import { prisma } from "@/global/database/prisma";
import { requireAuth } from "@/global/middleware/auth.guard";
import { learningEngineService } from "@/features/learning/application/learning-engine.service";
import { goalEvaluatorService } from "@/features/learning/application/goal-evaluator.service";
import { adaptiveLearningService } from "@/features/learning/application/adaptive-learning.service";
import { planService } from "@/features/subscription/application/plan.service";
import { quotaService } from "@/features/subscription/application/quota.service";
import { mapSubscriptionErrorResponse } from "@/features/subscription/presentation/utils/subscription-response";
import { getCharacterDisplayName } from "@/features/learning/domain/constants/tutors";
import { getScenario } from "@/features/learning/domain/constants/scenarios";
import { errorResponse, successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";

const createConversationSchema = z.object({
  characterId: z.string().min(1),
  personality: z.string().min(1),
  language: z.string().default("en"),
  title: z.string().optional(),
  scenarioType: z.string().min(1),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  objective: z.string().optional(),
});

export async function createConversationHandler(request: Request) {
  try {
    const auth = await requireAuth();

    const body = await request.json();
    const parsed = createConversationSchema.safeParse(body);

    if (!parsed.success) {
      return withCors(errorResponse(parsed.error.issues[0].message, 422));
    }

    const {
      characterId,
      personality,
      language,
      title,
      scenarioType,
      difficulty,
      objective,
    } = parsed.data;

    learningEngineService.validateSessionConfig({
      scenarioType,
      difficulty,
      objective,
    });

    const scenario = getScenario(scenarioType);
    const displayName = getCharacterDisplayName(characterId);

    await quotaService.assertCanCreateConversation(auth.userId);

    const { planId } = await planService.getUserPlanSnapshot(auth.userId);
    quotaService.assertScenarioAllowed(planId, scenarioType, scenario.label);
    quotaService.assertTutorAllowed(planId, characterId, displayName);

    const resolvedObjective = learningEngineService.resolveObjective(
      scenarioType,
      objective,
    );
    const defaultTitle = `${scenario.label} with ${displayName}`;

    const sessionGoals = goalEvaluatorService.buildGoals(difficulty);
    const assistanceState = adaptiveLearningService.createInitialState();

    const conversation = await prisma.conversation.create({
      data: {
        userId: auth.userId,
        characterId,
        personality,
        language,
        scenarioType,
        difficulty,
        objective: resolvedObjective,
        title: title || defaultTitle,
        status: "ACTIVE",
        sessionGoals,
        assistanceState,
      },
    });

    return withCors(
      successResponse({
        id: conversation.id,
        scenarioType,
        difficulty,
        objective: resolvedObjective,
        sessionGoals,
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return withCors(errorResponse("Unauthorized", 401));
    }

    if (error instanceof Error && error.message.includes("tidak valid")) {
      return withCors(errorResponse(error.message, 422));
    }

    const subscriptionResponse = mapSubscriptionErrorResponse(error);
    if (subscriptionResponse) {
      return withCors(subscriptionResponse);
    }

    return withCors(errorResponse("Gagal membuat percakapan", 500));
  }
}
