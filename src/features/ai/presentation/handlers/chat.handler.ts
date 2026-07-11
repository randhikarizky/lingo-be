import { z } from "zod";

import { kieAiClient } from "@/global/ai/kie-ai.client";
import {
  apiErrorResponse,
  inferErrorCodeFromMessage,
} from "@/global/utils/api-error";
import {
  assertActiveConversationAccess,
  ConversationAccessError,
} from "@/features/conversation/application/conversation-access.service";
import { learningEngineService } from "@/features/learning/application/learning-engine.service";
import { logConversationGuardEvent } from "@/features/learning/application/conversation-guard.analytics";
import { conversationGuardService } from "@/features/learning/application/conversation-guard.service";
import { quotaService } from "@/features/subscription/application/quota.service";
import { usageService } from "@/features/subscription/application/usage.service";
import { mapSubscriptionErrorResponse } from "@/features/subscription/presentation/utils/subscription-response";
import { requireAuth } from "@/global/middleware/auth.guard";
import { successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";
import { prisma } from "@/global/database/prisma";

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant", "developer"]),
        content: z.string().min(1),
      }),
    )
    .min(1),
  model: z.enum(["gpt-5-2", "gemini-2.5-pro"]).optional(),
  conversationId: z.string().uuid(),
  userAudioUrl: z.string().url().optional(),
  userAudioKey: z.string().optional(),
  userAudioMimeType: z.string().optional(),
  userAudioSize: z.number().int().nonnegative().optional(),
});

function extractCorrectionsJson(content: string) {
  const bracketMatches = [...content.matchAll(/\[([^|]+)\|([^\]]+)\]/g)];
  if (bracketMatches.length > 0) {
    return bracketMatches.map((match) => ({
      wrong: match[1].trim(),
      correct: match[2].trim(),
    }));
  }
  return null;
}

export async function chatHandler(request: Request) {
  try {
    const auth = await requireAuth();

    const body = await request.json();
    const parsed = chatSchema.safeParse(body);

    if (!parsed.success) {
      return apiErrorResponse(request, parsed.error.issues[0].message, 422);
    }

    const {
      conversationId,
      messages,
      model,
      userAudioUrl,
      userAudioKey,
      userAudioMimeType,
      userAudioSize,
    } = parsed.data;
    const userMessages = messages.filter((m) => m.role === "user");
    const lastUserMessage = userMessages[userMessages.length - 1];
    const conversationMessages = messages.filter((m) => m.role !== "system");

    await quotaService.assertChatAllowed(auth.userId);

    const conversation = await assertActiveConversationAccess(
      auth.userId,
      conversationId,
    );

    const sessionMetadata = {
      characterId: conversation.characterId,
      personality: conversation.personality,
      scenarioType: conversation.scenarioType,
      difficulty: conversation.difficulty,
      objective: conversation.objective,
      language: conversation.language,
    };

    const systemPrompt = learningEngineService.buildSystemPrompt(sessionMetadata);

    const resolvedModel =
      model ?? learningEngineService.resolveModel(conversation.personality);

    const guardState = {
      focusScore: conversation.focusScore,
      redirectCount: conversation.guardRedirectCount,
    };

    const guardEvaluation = lastUserMessage
      ? conversationGuardService.evaluate(
          lastUserMessage.content,
          sessionMetadata,
          guardState,
        )
      : null;

    const guardResult = guardEvaluation?.result;
    const nextGuardState = guardEvaluation?.nextState ?? guardState;

    if (guardResult) {
      logConversationGuardEvent(guardResult.category, {
        conversationId,
        focusScore: nextGuardState.focusScore,
        redirectCount: nextGuardState.redirectCount,
      });
    }

    const result =
      guardResult && !guardResult.allowAI
        ? {
            content: guardResult.redirectMessage!,
            mock: false,
            model: resolvedModel,
          }
        : await kieAiClient.chatCompletion({
            model: resolvedModel,
            messages: [
              { role: "system" as const, content: systemPrompt },
              ...conversationMessages,
            ],
          });

    let userMessageId: string | undefined;
    let assistantMessageId: string | undefined;

    if (lastUserMessage) {
      const corrections = extractCorrectionsJson(result.content);
      const userAudioMetadata =
        userAudioUrl && userAudioKey
          ? {
              audio: {
                key: userAudioKey,
                url: userAudioUrl,
                mimeType: userAudioMimeType ?? "audio/webm",
                size: userAudioSize ?? 0,
                createdAt: new Date().toISOString(),
              },
            }
          : undefined;

      await prisma.$transaction(async (tx) => {
        const userMessage = await tx.message.create({
          data: {
            conversationId,
            role: "USER",
            content: lastUserMessage.content,
            audioUrl: userAudioUrl,
            metadata: userAudioMetadata,
          },
        });

        const assistantMessage = await tx.message.create({
          data: {
            conversationId,
            role: "ASSISTANT",
            content: result.content,
            correction: corrections || undefined,
          },
        });

        userMessageId = userMessage.id;
        assistantMessageId = assistantMessage.id;

        await tx.conversation.update({
          where: { id: conversationId },
          data: {
            focusScore: nextGuardState.focusScore,
            guardRedirectCount: nextGuardState.redirectCount,
            updatedAt: new Date(),
          },
        });
      });
    }

    if (!guardResult || guardResult.allowAI) {
      await usageService.recordUsage({
        userId: auth.userId,
        type: "CHAT",
        amount: 1,
        metadata: { conversationId },
      });
    }

    return withCors(
      successResponse({
        ...result,
        userMessageId,
        assistantMessageId,
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return apiErrorResponse(request, "Unauthorized", 401);
    }

    if (error instanceof ConversationAccessError) {
      return apiErrorResponse(request, error.message, error.status);
    }

    const subscriptionResponse = mapSubscriptionErrorResponse(error);
    if (subscriptionResponse) {
      return withCors(subscriptionResponse);
    }

    const message =
      error instanceof Error ? error.message : "Gagal memproses chat AI";
    const errorCode = inferErrorCodeFromMessage(message);
    const status = errorCode === "AI_PROVIDER_ERROR" ? 503 : 500;

    return apiErrorResponse(request, message, status, errorCode);
  }
}
