import { getMockTranscript } from "@/features/speech/domain/constants/mock-transcripts";
import {
  parseTranscribeMultipart,
  TranscribeValidationError,
} from "@/features/speech/presentation/utils/parse-multipart-audio";
import { isMockAiEnabled } from "@/global/config/mock.config";
import { requireAuth } from "@/global/middleware/auth.guard";
import { errorResponse, successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";

export async function transcribeHandler(request: Request) {
  try {
    await requireAuth();

    const parsed = await parseTranscribeMultipart(request);
    const transcript = getMockTranscript(parsed.language);
    const isMock = isMockAiEnabled();

    return withCors(
      successResponse({
        transcript,
        mock: isMock,
        message: isMock
          ? "STT dummy — audio diterima, mengembalikan teks contoh karena Kie AI belum dikonfigurasi."
          : "Transkripsi berhasil (mock STT — integrasi Kie AI STT belum tersedia).",
      })
    );
  } catch (error) {
    if (error instanceof TranscribeValidationError) {
      return withCors(errorResponse(error.message, error.status));
    }

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return withCors(errorResponse("Unauthorized", 401));
    }

    return withCors(errorResponse("Gagal transkripsi audio", 500));
  }
}
