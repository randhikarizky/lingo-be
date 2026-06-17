import { z } from "zod";

import { kieAiClient } from "@/global/ai/kie-ai.client";
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
  conversationId: z.string().optional(),
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

    if (conversationId) {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation) {
        return withCors(errorResponse("Percakapan tidak ditemukan", 404));
      }

      if (conversation.userId !== auth.userId) {
        return withCors(errorResponse("Forbidden", 403));
      }

      // Save user message (the last user message in the array)
      const userMessages = messages.filter((m) => m.role === "user");
      const lastUserMessage = userMessages[userMessages.length - 1];

      if (lastUserMessage) {
        await prisma.message.create({
          data: {
            conversationId,
            role: "USER",
            content: lastUserMessage.content,
          },
        });
      }
    }

    const result = await kieAiClient.chatCompletion({
      model,
      messages,
    });

    if (conversationId) {
      const corrections = extractCorrectionsJson(result.content);

      await prisma.message.create({
        data: {
          conversationId,
          role: "ASSISTANT",
          content: result.content,
          correction: corrections || undefined,
        },
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    }

    return withCors(successResponse(result));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return withCors(errorResponse("Unauthorized", 401));
    }

    const message =
      error instanceof Error ? error.message : "Gagal memproses chat AI";

    return withCors(errorResponse(message, 500));
  }
}
