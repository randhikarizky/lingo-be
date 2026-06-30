import { prisma } from "@/global/database/prisma";
import { requireAuth } from "@/global/middleware/auth.guard";
import { goalEvaluatorService } from "@/features/learning/application/goal-evaluator.service";
import type { SessionGoal } from "@/features/learning/domain/types/learning-session.types";
import { getScenario } from "@/features/learning/domain/constants/scenarios";
import { parseUuid } from "@/global/utils/uuid";
import { errorResponse, successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";

function parseStoredGoals(value: unknown): SessionGoal[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value as SessionGoal[];
}

export async function detailConversationHandler(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await context.params;
    const parsedId = parseUuid(id, "Conversation ID");

    if (!parsedId.ok) {
      return withCors(errorResponse(parsedId.message, 422));
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: parsedId.value },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversation) {
      return withCors(errorResponse("Percakapan tidak ditemukan", 404));
    }

    if (conversation.userId !== auth.userId) {
      return withCors(errorResponse("Forbidden", 403));
    }

    const scenario = getScenario(conversation.scenarioType);
    const storedGoals = parseStoredGoals(conversation.sessionGoals);
    const sessionGoals =
      conversation.status === "COMPLETED" && storedGoals
        ? storedGoals
        : goalEvaluatorService.evaluate(
            conversation.difficulty,
            conversation.messages,
            storedGoals
          );

    const responseData = {
      id: conversation.id,
      title: conversation.title,
      characterId: conversation.characterId,
      personality: conversation.personality,
      language: conversation.language,
      scenarioType: conversation.scenarioType,
      scenarioLabel: scenario.label,
      scenarioCategory: scenario.category,
      difficulty: conversation.difficulty,
      objective: conversation.objective,
      status: conversation.status,
      summary: conversation.summary,
      metrics: conversation.metrics,
      sessionGoals,
      messages: conversation.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        correction: m.correction,
        createdAt: m.createdAt.toISOString(),
      })),
    };

    return withCors(successResponse(responseData));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return withCors(errorResponse("Unauthorized", 401));
    }
    return withCors(errorResponse("Gagal memuat detail percakapan", 500));
  }
}
