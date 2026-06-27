import { prisma } from "@/global/database/prisma";
import { requireAuth } from "@/global/middleware/auth.guard";
import { learningEngineService } from "@/features/learning/application/learning-engine.service";
import { sessionSummaryService } from "@/features/learning/application/session-summary.service";
import { getScenario } from "@/features/learning/domain/constants/scenarios";
import { errorResponse, successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";

export async function endSessionHandler(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await context.params;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
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

    if (conversation.status === "COMPLETED" && conversation.summary && conversation.metrics) {
      return withCors(
        successResponse({
          id: conversation.id,
          status: conversation.status,
          summary: conversation.summary,
          metrics: conversation.metrics,
        })
      );
    }

    const metrics = learningEngineService.computeMetrics(conversation.messages);
    const scenario = getScenario(conversation.scenarioType);

    const summary = await sessionSummaryService.generate({
      personality: conversation.personality,
      scenarioLabel: scenario.label,
      objective: conversation.objective,
      difficulty: conversation.difficulty,
      messages: conversation.messages,
      metrics,
    });

    const updated = await prisma.conversation.update({
      where: { id },
      data: {
        status: "COMPLETED",
        summary,
        metrics,
        updatedAt: new Date(),
      },
    });

    return withCors(
      successResponse({
        id: updated.id,
        status: updated.status,
        summary,
        metrics,
      })
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
