import { z } from "zod";

import { kieAiClient } from "@/global/ai/kie-ai.client";
import {
  assertActiveConversationAccess,
  ConversationAccessError,
} from "@/features/conversation/application/conversation-access.service";
import { learningEngineService } from "@/features/learning/application/learning-engine.service";
import { quotaService } from "@/features/subscription/application/quota.service";
import { usageService } from "@/features/subscription/application/usage.service";
import { mapSubscriptionErrorResponse } from "@/features/subscription/presentation/utils/subscription-response";
import { requireAuth } from "@/global/middleware/auth.guard";
import { errorResponse, successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";
import { prisma } from "@/global/database/prisma";

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant", "developer"]),
        content: z.string().min(1),
      })
    )
    .min(1),
  model: z.enum(["gpt-5-2", "gemini-2.5-pro"]).optional(),
  conversationId: z.string().uuid(),
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
      return withCors(errorResponse(parsed.error.issues[0].message, 422));
    }

    const { conversationId, messages, model } = parsed.data;
    const userMessages = messages.filter((m) => m.role === "user");
    const lastUserMessage = userMessages[userMessages.length - 1];
    const conversationMessages = messages.filter((m) => m.role !== "system");

    await quotaService.assertChatAllowed(auth.userId);

    const conversation = await assertActiveConversationAccess(auth.userId, conversationId);

    const systemPrompt = learningEngineService.buildSystemPrompt({
      characterId: conversation.characterId,
      personality: conversation.personality,
      scenarioType: conversation.scenarioType,
      difficulty: conversation.difficulty,
      objective: conversation.objective,
      language: conversation.language,
    });

    const resolvedModel =
      model ?? learningEngineService.resolveModel(conversation.personality);

    const aiMessages = [{ role: "system" as const, content: systemPrompt }, ...conversationMessages];

    const result = await kieAiClient.chatCompletion({
      model: resolvedModel,
      messages: aiMessages,
    });

    if (lastUserMessage) {
      const corrections = extractCorrectionsJson(result.content);

      await prisma.$transaction(async (tx) => {
        await tx.message.create({
          data: {
            conversationId,
            role: "USER",
            content: lastUserMessage.content,
          },
        });

        await tx.message.create({
          data: {
            conversationId,
            role: "ASSISTANT",
            content: result.content,
            correction: corrections || undefined,
          },
        });

        await tx.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });
      });
    }

    await usageService.recordUsage({
      userId: auth.userId,
      type: "CHAT",
      amount: 1,
      metadata: { conversationId },
    });

    return withCors(successResponse(result));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return withCors(errorResponse("Unauthorized", 401));
    }

    if (error instanceof ConversationAccessError) {
      return withCors(errorResponse(error.message, error.status));
    }

    const subscriptionResponse = mapSubscriptionErrorResponse(error);
    if (subscriptionResponse) {
      return withCors(subscriptionResponse);
    }

    const message =
      error instanceof Error ? error.message : "Gagal memproses chat AI";

    return withCors(errorResponse(message, 500));
  }
}
