import path from "path";

import { isStoragePublic } from "@/global/config/env";
import { storageService } from "@/features/storage/application/storage.service";
import { requireAuth } from "@/global/middleware/auth.guard";
import { errorResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";

const MIME_TYPES: Record<string, string> = {
  ".webm": "audio/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".txt": "text/plain",
  ".json": "application/json",
};

export async function localFileHandler(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path: segments } = await context.params;
    const key = segments.map(decodeURIComponent).join("/");
    const allowDevVoicePlayback =
      process.env.NODE_ENV === "development" && key.startsWith("voice/");

    if (!allowDevVoicePlayback) {
      if (process.env.NODE_ENV === "production" && !isStoragePublic()) {
        return withCors(errorResponse("Forbidden", 403));
      }

      await requireAuth();
    }
    const buffer = await storageService.download(key);
    const ext = path.extname(key).toLowerCase();

    return withCors(
      new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream",
          "Cache-Control": "private, max-age=3600",
        },
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return withCors(errorResponse("Unauthorized", 401));
    }

    return withCors(errorResponse("File tidak ditemukan", 404));
  }
}
