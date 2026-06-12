import path from "path";

import { localStorageClient } from "@/global/storage/local-storage.client";
import { errorResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";

const MIME_TYPES: Record<string, string> = {
  ".webm": "audio/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".txt": "text/plain",
  ".json": "application/json",
};

export async function localFileHandler(
  _request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await context.params;
    const key = segments.map(decodeURIComponent).join("/");
    const buffer = await localStorageClient.readObject(key);
    const ext = path.extname(key).toLowerCase();

    return withCors(
      new Response(buffer, {
        status: 200,
        headers: {
          "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream",
          "Cache-Control": "private, max-age=3600",
        },
      })
    );
  } catch {
    return withCors(errorResponse("File tidak ditemukan", 404));
  }
}
