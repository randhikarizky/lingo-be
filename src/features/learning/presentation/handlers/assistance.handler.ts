import { z } from "zod";

import { prisma } from "@/global/database/prisma";
import {
  assertActiveConversationAccess,
  ConversationAccessError,
} from "@/features/conversation/application/conversation-access.service";
import {
  adaptiveLearningService,
  parseAssistanceState,
} from "@/features/learning/application/adaptive-learning.service";
import type { AssistanceAction } from "@/features/learning/domain/types/adaptive-learning.types";
import { requireAuth } from "@/global/middleware/auth.guard";
import { parseUuid } from "@/global/utils/uuid";
import { errorResponse, successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";

const assistanceSchema = z.object({
  action: z.enum(["tooltip", "hint", "example", "coach", "dismiss", "sync"]),
  objectiveId: z.string().optional(),
  idleSeconds: z.number().int().nonnegative().optional(),
  objectiveStaleSeconds: z.number().int().nonnegative().optional(),
});

export async function assistanceHandler(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    const { id } = await context.params;
    const parsedId = parseUuid(id, "Conversation ID");

    if (!parsedId.ok) {
      return withCors(errorResponse(parsedId.message, 422));
    }

    const conversation = await assertActiveConversationAccess(
      auth.userId,
      parsedId.value,
    );

    const body = await request.json();
    const parsed = assistanceSchema.safeParse(body);

    if (!parsed.success) {
      return withCors(errorResponse(parsed.error.issues[0].message, 422));
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: parsedId.value },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true },
    });

    const currentState = parseAssistanceState(conversation.assistanceState);
    const result = adaptiveLearningService.handleAction({
      action: parsed.data.action as AssistanceAction,
      scenarioType: conversation.scenarioType,
      difficulty: conversation.difficulty,
      state: currentState,
      messages,
      idleSeconds: parsed.data.idleSeconds,
      objectiveStaleSeconds: parsed.data.objectiveStaleSeconds,
      conversationId: parsedId.value,
    });

    await prisma.conversation.update({
      where: { id: parsedId.value },
      data: {
        assistanceState: result.state,
        updatedAt: new Date(),
      },
    });

    return withCors(successResponse(result.response));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return withCors(errorResponse("Unauthorized", 401));
    }

    if (error instanceof ConversationAccessError) {
      return withCors(errorResponse(error.message, error.status));
    }

    return withCors(errorResponse("Gagal memproses bantuan belajar", 500));
  }
}

export async function getAssistanceHandler(
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
          select: { role: true, content: true },
        },
      },
    });

    if (!conversation) {
      return withCors(errorResponse("Percakapan tidak ditemukan", 404));
    }

    if (conversation.userId !== auth.userId) {
      return withCors(errorResponse("Forbidden", 403));
    }

    const state = parseAssistanceState(conversation.assistanceState);
    const syncedState = adaptiveLearningService.applyUserMessage(
      state,
      conversation.scenarioType,
      conversation.messages,
    );
    const missionObjectives = adaptiveLearningService.buildMissionObjectives(
      conversation.scenarioType,
      syncedState.objectiveProgress,
    );
    const activeObjective =
      adaptiveLearningService.getActiveObjectiveDefinition(
        conversation.scenarioType,
        syncedState.objectiveProgress,
      );

    return withCors(
      successResponse({
        missionObjectives,
        activeObjectiveId: activeObjective?.id ?? null,
        stuckSuggested: adaptiveLearningService.detectStuck({
          failedAttempts: syncedState.failedAttempts,
        }),
        cooldown: adaptiveLearningService.resolveCooldown(syncedState),
        assistanceLevel: syncedState.maxLevelUsed,
        hintCount: syncedState.hintCount,
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return withCors(errorResponse("Unauthorized", 401));
    }

    return withCors(errorResponse("Gagal memuat bantuan belajar", 500));
  }
}
