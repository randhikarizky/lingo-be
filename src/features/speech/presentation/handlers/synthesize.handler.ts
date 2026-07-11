import { z } from "zod";

import { prisma } from "@/global/database/prisma";
import { voiceService } from "@/features/speech/application/voice.service";
import { audioStorageService } from "@/features/storage/application/audio-storage.service";
import { storageService } from "@/features/storage/application/storage.service";
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
import { logError, logInfo, logWarn } from "@/global/utils/logger";
import { attachRequestId, getRequestId } from "@/global/utils/request-id";
import { errorResponse, successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";

const synthesizeSchema = z.object({
  text: z.string().min(1).max(5000),
  conversationId: z.string().uuid().optional(),
  messageId: z.string().uuid().optional(),
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
        attachRequestId(
          errorResponse(parsed.error.issues[0].message, 422),
          requestId,
        ),
        request,
      );
    }

    const estimatedMinutes = estimateSpeakingMinutesFromText(parsed.data.text);
    await quotaService.assertSpeakingAllowed(auth.userId, estimatedMinutes);

    if (parsed.data.conversationId) {
      await assertActiveConversationAccess(
        auth.userId,
        parsed.data.conversationId,
      );
    }

    logInfo(requestId, "speech.synthesize.request", {
      textLength: parsed.data.text.length,
      language: parsed.data.language,
      messageId: parsed.data.messageId,
    });

    const cacheKey = audioStorageService.buildAssistantVoiceKey(
      parsed.data.text,
      parsed.data.voice,
      parsed.data.language,
    );

    if (await storageService.exists(cacheKey)) {
      const audioUrl = process.env.AWS_PUBLIC_URL?.trim()
        ? storageService.getPublicUrl(cacheKey)
        : await storageService.getSignedUrl(cacheKey, 60 * 60 * 24 * 7, requestId);

      if (parsed.data.messageId) {
        try {
          await prisma.message.update({
            where: { id: parsed.data.messageId },
            data: {
              audioUrl,
              metadata: {
                audio: {
                  key: cacheKey,
                  url: audioUrl,
                  mimeType: "audio/mpeg",
                  size: 0,
                  createdAt: new Date().toISOString(),
                },
              },
            },
          });
        } catch (error) {
          logWarn(requestId, "speech.synthesize.messageUpdateFailed", {
            messageId: parsed.data.messageId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return withCors(
        attachRequestId(
          successResponse({
            audioUrl,
            mimeType: "audio/mpeg",
            cached: true,
            mock: false,
          }),
          requestId,
        ),
        request,
      );
    }

    const result = await voiceService.synthesize({
      text: parsed.data.text,
      language: parsed.data.language,
      voice: parsed.data.voice,
      requestId,
    });

    let storedAudio:
      | Awaited<
          ReturnType<typeof audioStorageService.getOrCreateAssistantVoice>
        >
      | undefined;

    try {
      storedAudio = await audioStorageService.getOrCreateAssistantVoice({
        text: parsed.data.text,
        audio: result.audio,
        mimeType: result.mimeType,
        voice: parsed.data.voice,
        language: parsed.data.language,
        requestId,
      });
    } catch (error) {
      logWarn(requestId, "speech.synthesize.storageFailed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (parsed.data.messageId && storedAudio) {
      try {
        await prisma.message.update({
          where: { id: parsed.data.messageId },
          data: {
            audioUrl: storedAudio.metadata.url,
            metadata: {
              audio: storedAudio.metadata,
            },
          },
        });
      } catch (error) {
        logWarn(requestId, "speech.synthesize.messageUpdateFailed", {
          messageId: parsed.data.messageId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logInfo(requestId, "speech.synthesize.response", {
      mock: result.mock,
      bytes: result.audio.length,
      mimeType: result.mimeType,
      cached: storedAudio?.cached ?? false,
      stored: Boolean(storedAudio),
    });

    if (!storedAudio) {
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
          successResponse({
            audioUrl: null,
            mimeType: result.mimeType,
            cached: false,
            mock: result.mock,
            fallbackBase64: result.audio.toString("base64"),
          }),
          requestId,
        ),
        request,
      );
    }

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
        successResponse({
          audioUrl: storedAudio.metadata.url,
          mimeType: storedAudio.metadata.mimeType,
          cached: storedAudio.cached,
          mock: result.mock,
        }),
        requestId,
      ),
      request,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return withCors(
        attachRequestId(errorResponse("Unauthorized", 401), requestId),
        request,
      );
    }

    if (error instanceof ConversationAccessError) {
      return withCors(
        attachRequestId(errorResponse(error.message, error.status), requestId),
        request,
      );
    }

    const subscriptionResponse = mapSubscriptionErrorResponse(error);
    if (subscriptionResponse) {
      return withCors(
        attachRequestId(subscriptionResponse, requestId),
        request,
      );
    }

    const message =
      error instanceof Error ? error.message : "Gagal sintesis suara";

    logError(requestId, "speech.synthesize.failed", { error: message });

    if (message.toLowerCase().includes("timeout")) {
      return withCors(
        attachRequestId(
          errorResponse("Layanan suara timeout. Coba lagi.", 504),
          requestId,
        ),
        request,
      );
    }

    return withCors(
      attachRequestId(errorResponse(message, 500), requestId),
      request,
    );
  }
}
