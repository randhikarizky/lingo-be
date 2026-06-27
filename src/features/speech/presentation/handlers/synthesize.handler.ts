import { z } from "zod";

import { voiceService } from "@/features/speech/application/voice.service";
import { requireAuth } from "@/global/middleware/auth.guard";
import { logError, logInfo } from "@/global/utils/logger";
import { attachRequestId, getRequestId } from "@/global/utils/request-id";
import { errorResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";

const synthesizeSchema = z.object({
  text: z.string().min(1).max(5000),
  conversationId: z.string().optional(),
  language: z.string().optional(),
  voice: z.string().optional(),
});

export async function synthesizeHandler(request: Request) {
  const requestId = getRequestId(request);

  try {
    await requireAuth();

    const body = await request.json();
    const parsed = synthesizeSchema.safeParse(body);

    if (!parsed.success) {
      return withCors(
        attachRequestId(errorResponse(parsed.error.issues[0].message, 422), requestId),
        request
      );
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
