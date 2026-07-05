import { prisma } from "@/global/database/prisma";
import { requireAuth } from "@/global/middleware/auth.guard";
import { goalEvaluatorService } from "@/features/learning/application/goal-evaluator.service";
import { learningEngineService } from "@/features/learning/application/learning-engine.service";
import { sessionSummaryService } from "@/features/learning/application/session-summary.service";
import type { SessionGoal } from "@/features/learning/domain/types/learning-session.types";
import { parseUuid } from "@/global/utils/uuid";
import { getScenario } from "@/features/learning/domain/constants/scenarios";
import { errorResponse, successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";

function parseStoredGoals(value: unknown): SessionGoal[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value as SessionGoal[];
}

export async function endSessionHandler(
  _request: Request,
  context: { params: Promise<{ id: string }> },
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

    if (
      conversation.status === "COMPLETED" &&
      conversation.summary &&
      conversation.metrics &&
      conversation.sessionGoals
    ) {
      const storedMetrics =
        typeof conversation.metrics === "object" && conversation.metrics
          ? (conversation.metrics as Record<string, unknown>)
          : {};

      return withCors(
        successResponse({
          id: conversation.id,
          status: conversation.status,
          summary: conversation.summary,
          metrics: {
            ...storedMetrics,
            focusScore:
              (storedMetrics.focusScore as number | undefined) ??
              conversation.focusScore,
            guardRedirectCount:
              (storedMetrics.guardRedirectCount as number | undefined) ??
              conversation.guardRedirectCount,
          },
          sessionGoals: conversation.sessionGoals,
        }),
      );
    }

    const baseMetrics = learningEngineService.computeMetrics(
      conversation.messages,
    );
    const metrics = {
      ...baseMetrics,
      focusScore: conversation.focusScore,
      guardRedirectCount: conversation.guardRedirectCount,
    };
    const scenario = getScenario(conversation.scenarioType);
    const storedGoals = parseStoredGoals(conversation.sessionGoals);
    const sessionGoals = goalEvaluatorService.evaluateFinal(
      conversation.difficulty,
      conversation.messages,
      metrics,
      storedGoals,
    );

    const summary = await sessionSummaryService.generate({
      personality: conversation.personality,
      scenarioLabel: scenario.label,
      objective: conversation.objective,
      difficulty: conversation.difficulty,
      messages: conversation.messages,
      metrics,
    });

    const updated = await prisma.conversation.update({
      where: { id: parsedId.value },
      data: {
        status: "COMPLETED",
        summary,
        metrics,
        sessionGoals,
        updatedAt: new Date(),
      },
    });

    return withCors(
      successResponse({
        id: updated.id,
        status: updated.status,
        summary,
        metrics,
        sessionGoals,
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return withCors(errorResponse("Unauthorized", 401));
    }

    const message =
      error instanceof Error ? error.message : "Gagal mengakhiri sesi latihan";

    return withCors(errorResponse(message, 500));
  }
}
