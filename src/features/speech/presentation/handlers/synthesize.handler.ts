import { z } from "zod";

import { voiceService } from "@/features/speech/application/voice.service";
import {
  assertActiveConversationAccess,
  ConversationAccessError,
} from "@/features/conversation/application/conversation-access.service";
import { quotaService } from "@/features/subscription/application/quota.service";
import {
  estimateSpeakingMinutesFromText,
  usageService,
} from "@/features/subscription/application/usage.service";
import { mapSubscriptionErrorResponse } from "@/features/subscription/presentation/utils/subscription-response";
import { requireAuth } from "@/global/middleware/auth.guard";
import { logError, logInfo } from "@/global/utils/logger";
import { attachRequestId, getRequestId } from "@/global/utils/request-id";
import { errorResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";

const synthesizeSchema = z.object({
  text: z.string().min(1).max(5000),
  conversationId: z.string().uuid().optional(),
  language: z.string().optional(),
  voice: z.string().optional(),
});

export async function synthesizeHandler(request: Request) {
  const requestId = getRequestId(request);

  try {
    const auth = await requireAuth();

    const body = await request.json();
    const parsed = synthesizeSchema.safeParse(body);

    if (!parsed.success) {
      return withCors(
        attachRequestId(errorResponse(parsed.error.issues[0].message, 422), requestId),
        request
      );
    }

    const estimatedMinutes = estimateSpeakingMinutesFromText(parsed.data.text);
    await quotaService.assertSpeakingAllowed(auth.userId, estimatedMinutes);

    if (parsed.data.conversationId) {
      await assertActiveConversationAccess(auth.userId, parsed.data.conversationId);
    }

    logInfo(requestId, "speech.synthesize.request", {
      textLength: parsed.data.text.length,
      language: parsed.data.language,
    });

    const result = await voiceService.synthesize({
      text: parsed.data.text,
      language: parsed.data.language,
      voice: parsed.data.voice,
      requestId,
    });

    logInfo(requestId, "speech.synthesize.response", {
      mock: result.mock,
      bytes: result.audio.length,
      mimeType: result.mimeType,
    });

    await usageService.recordUsage({
      userId: auth.userId,
      type: "TTS",
      amount: 1,
      metadata: parsed.data.conversationId
        ? { conversationId: parsed.data.conversationId }
        : undefined,
    });
    await usageService.recordUsage({
      userId: auth.userId,
      type: "SPEAKING",
      amount: estimatedMinutes,
    });

    return withCors(
      attachRequestId(
        new Response(new Uint8Array(result.audio), {
          status: 200,
          headers: {
            "Content-Type": result.mimeType,
            "Cache-Control": "no-store",
            "X-Voice-Mock": result.mock ? "true" : "false",
          },
        }),
        requestId
      ),
      request
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return withCors(
        attachRequestId(errorResponse("Unauthorized", 401), requestId),
        request
      );
    }

    if (error instanceof ConversationAccessError) {
      return withCors(
        attachRequestId(errorResponse(error.message, error.status), requestId),
        request
      );
    }

    const subscriptionResponse = mapSubscriptionErrorResponse(error);
    if (subscriptionResponse) {
      return withCors(attachRequestId(subscriptionResponse, requestId), request);
    }

    const message =
      error instanceof Error ? error.message : "Gagal sintesis suara";

    logError(requestId, "speech.synthesize.failed", { error: message });

    if (message.toLowerCase().includes("timeout")) {
      return withCors(
        attachRequestId(
          errorResponse("Layanan suara timeout. Coba lagi.", 504),
          requestId
        ),
        request
      );
    }

    return withCors(
      attachRequestId(errorResponse(message, 500), requestId),
      request
    );
  }
}
