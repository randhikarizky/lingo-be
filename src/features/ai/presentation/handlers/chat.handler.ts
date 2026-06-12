import { z } from "zod";

import { kieAiClient } from "@/global/ai/kie-ai.client";
import { requireAuth } from "@/global/middleware/auth.guard";
import { errorResponse, successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";

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
});

export async function chatHandler(request: Request) {
  try {
    await requireAuth();

    const body = await request.json();
    const parsed = chatSchema.safeParse(body);

    if (!parsed.success) {
      return withCors(errorResponse(parsed.error.issues[0].message, 422));
    }

    const result = await kieAiClient.chatCompletion({
      model: parsed.data.model,
      messages: parsed.data.messages,
    });

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
