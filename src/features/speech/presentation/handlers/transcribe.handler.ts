import { voiceService } from "@/features/speech/application/voice.service";
import {
  parseTranscribeMultipart,
  TranscribeValidationError,
} from "@/features/speech/presentation/utils/parse-multipart-audio";
import { requireAuth } from "@/global/middleware/auth.guard";
import { logError, logInfo, logWarn } from "@/global/utils/logger";
import { attachRequestId, getRequestId } from "@/global/utils/request-id";
import { errorResponse, successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";

export async function transcribeHandler(request: Request) {
  const requestId = getRequestId(request);

  try {
    await requireAuth();

    logInfo(requestId, "speech.transcribe.request");

    const parsed = await parseTranscribeMultipart(request);
    const result = await voiceService.transcribe({
      audio: parsed.audio.buffer,
      mimeType: parsed.audio.mimeType,
      fileName: parsed.audio.fileName,
      language: parsed.language,
      requestId,
    });

    logInfo(requestId, "speech.transcribe.response", {
      mock: result.mock,
      textLength: result.text.length,
    });

    return withCors(
      attachRequestId(
        successResponse({
          text: result.text,
          transcript: result.text,
          mock: result.mock,
          message: result.mock
            ? "STT mock — gunakan MOCK_VOICE=false dan KIE_AI_API_KEY untuk provider real."
            : "Transkripsi berhasil",
        }),
        requestId
      ),
      request
    );
  } catch (error) {
    if (error instanceof TranscribeValidationError) {
      logWarn(requestId, "speech.transcribe.validationFailed", {
        message: error.message,
        status: error.status,
      });
      return withCors(
        attachRequestId(errorResponse(error.message, error.status), requestId),
        request
      );
    }

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return withCors(
        attachRequestId(errorResponse("Unauthorized", 401), requestId),
        request
      );
    }

    const message =
      error instanceof Error ? error.message : "Gagal transkripsi audio";

    logError(requestId, "speech.transcribe.failed", { error: message });

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
