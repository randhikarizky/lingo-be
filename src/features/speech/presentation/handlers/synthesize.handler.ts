import { z } from "zod";

import { isMockStorageEnabled } from "@/global/config/mock.config";
import { requireAuth } from "@/global/middleware/auth.guard";
import {
  buildRecordingKey,
  s3StorageClient,
} from "@/global/storage/s3.client";
import { errorResponse, successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";

const synthesizeSchema = z.object({
  text: z.string().min(1),
  conversationId: z.string().optional(),
});

export async function synthesizeHandler(request: Request) {
  try {
    const auth = await requireAuth();

    const body = await request.json();
    const parsed = synthesizeSchema.safeParse(body);

    if (!parsed.success) {
      return withCors(errorResponse(parsed.error.issues[0].message, 422));
    }

    const conversationId = parsed.data.conversationId ?? "mock-conversation";
    const key = buildRecordingKey(
      auth.userId,
      conversationId,
      `tts-${Date.now()}.txt`
    );

    const placeholderAudio = Buffer.from(
      `[MOCK TTS]\n${parsed.data.text}`,
      "utf-8"
    );

    const upload = await s3StorageClient.uploadRecording({
      key,
      body: placeholderAudio,
      contentType: "text/plain",
    });

    return withCors(
      successResponse({
        audioUrl: upload.url,
        text: parsed.data.text,
        mock: upload.mock,
        message: isMockStorageEnabled()
          ? "TTS dummy — file disimpan di local storage karena AWS belum dikonfigurasi."
          : "Sintesis suara berhasil",
      })
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return withCors(errorResponse("Unauthorized", 401));
    }

    return withCors(errorResponse("Gagal sintesis suara", 500));
  }
}
