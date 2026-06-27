import type { KieRequestOptions } from "@/features/speech/infrastructure/kie-jobs.client";
import { logError, logInfo } from "@/global/utils/logger";
import { withExponentialBackoff } from "@/global/utils/retry";

const KIE_FILE_UPLOAD_URL =
  process.env.KIE_FILE_UPLOAD_URL ?? "https://kieai.redpandaai.co";
const KIE_AI_API_KEY = process.env.KIE_AI_API_KEY ?? "";

type KieFileUploadResponse = {
  success: boolean;
  code: number;
  msg: string;
  data?: {
    fileUrl?: string;
    downloadUrl?: string;
  };
};

export async function uploadAudioToKie(
  params: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
  },
  options?: KieRequestOptions
) {
  const requestId = options?.requestId;

  if (requestId) {
    logInfo(requestId, "kie.upload.start", {
      fileName: params.fileName,
      mimeType: params.mimeType,
      bytes: params.buffer.length,
    });
  }

  const formData = new FormData();
  const bytes = new Uint8Array(params.buffer);
  const blob = new Blob([bytes], { type: params.mimeType });
  formData.append("file", blob, params.fileName);
  formData.append("uploadPath", "lingora/speech");
  formData.append("fileName", params.fileName);

  const response = await withExponentialBackoff(
    () =>
      fetch(`${KIE_FILE_UPLOAD_URL}/api/file-stream-upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${KIE_AI_API_KEY}`,
        },
        body: formData,
      }),
    {
      maxAttempts: 3,
      baseDelayMs: 500,
      requestId,
      label: "kie.upload",
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    const message = `Kie file upload error (${response.status}): ${errorText}`;

    if (requestId) {
      logError(requestId, "kie.upload.failed", { status: response.status });
    }

    throw new Error(message);
  }

  const payload = (await response.json()) as KieFileUploadResponse;
  const fileUrl = payload.data?.fileUrl ?? payload.data?.downloadUrl;

  if (!payload.success || !fileUrl) {
    const message = payload.msg || "Upload audio ke Kie AI gagal";

    if (requestId) {
      logError(requestId, "kie.upload.rejected", { msg: payload.msg });
    }

    throw new Error(message);
  }

  if (requestId) {
    logInfo(requestId, "kie.upload.success", { fileUrl });
  }

  return fileUrl;
}
