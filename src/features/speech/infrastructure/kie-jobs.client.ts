import { logError, logInfo, logWarn } from "@/global/utils/logger";
import { isRetryableHttpStatus, sleep, withExponentialBackoff } from "@/global/utils/retry";

const KIE_AI_BASE_URL = process.env.KIE_AI_BASE_URL ?? "https://api.kie.ai";
const KIE_AI_API_KEY = process.env.KIE_AI_API_KEY ?? "";
const DEFAULT_POLL_TIMEOUT_MS = Number(process.env.KIE_POLL_TIMEOUT_MS) || 90_000;
const DEFAULT_POLL_INTERVAL_MS = Number(process.env.KIE_POLL_INTERVAL_MS) || 2_000;
const MAX_POLL_INTERVAL_MS = 10_000;
const POLL_FETCH_MAX_ATTEMPTS = 3;
const POLL_FETCH_BASE_DELAY_MS = 500;

type KieJobState = "waiting" | "queuing" | "generating" | "success" | "fail";

type KieCreateTaskResponse = {
  code: number;
  msg: string;
  data?: { taskId: string };
};

type KieRecordInfoResponse = {
  code: number;
  msg: string;
  data?: {
    taskId: string;
    state: KieJobState;
    resultJson?: string;
    failCode?: string;
    failMsg?: string;
  };
};

export type KieRequestOptions = {
  requestId?: string;
};

function getAuthHeaders() {
  return {
    Authorization: `Bearer ${KIE_AI_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export async function createKieTask(
  params: {
    model: string;
    input: Record<string, unknown>;
  },
  options?: KieRequestOptions
) {
  const requestId = options?.requestId;

  if (requestId) {
    logInfo(requestId, "kie.createTask.start", { model: params.model });
  }

  const response = await withExponentialBackoff(
    () =>
      fetch(`${KIE_AI_BASE_URL}/api/v1/jobs/createTask`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          model: params.model,
          input: params.input,
        }),
      }),
    {
      maxAttempts: POLL_FETCH_MAX_ATTEMPTS,
      baseDelayMs: POLL_FETCH_BASE_DELAY_MS,
      requestId,
      label: "kie.createTask",
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    const message = `Kie createTask error (${response.status}): ${errorText}`;

    if (requestId) {
      logError(requestId, "kie.createTask.failed", { status: response.status });
    }

    throw new Error(message);
  }

  const payload = (await response.json()) as KieCreateTaskResponse;

  if (payload.code !== 200 || !payload.data?.taskId) {
    const message = payload.msg || "Kie createTask gagal";

    if (requestId) {
      logError(requestId, "kie.createTask.rejected", { code: payload.code, msg: payload.msg });
    }

    throw new Error(message);
  }

  if (requestId) {
    logInfo(requestId, "kie.createTask.success", { taskId: payload.data.taskId });
  }

  return payload.data.taskId;
}

async function fetchKieRecordInfo(taskId: string, requestId?: string) {
  return withExponentialBackoff(
    async () => {
      const response = await fetch(
        `${KIE_AI_BASE_URL}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${KIE_AI_API_KEY}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();

        if (isRetryableHttpStatus(response.status)) {
          throw new Error(`Kie recordInfo error (${response.status}): ${errorText}`);
        }

        const message = `Kie recordInfo error (${response.status}): ${errorText}`;

        if (requestId) {
          logError(requestId, "kie.recordInfo.failed", {
            taskId,
            status: response.status,
          });
        }

        throw new Error(message);
      }

      return (await response.json()) as KieRecordInfoResponse;
    },
    {
      maxAttempts: POLL_FETCH_MAX_ATTEMPTS,
      baseDelayMs: POLL_FETCH_BASE_DELAY_MS,
      requestId,
      label: "kie.recordInfo",
    }
  );
}

export async function pollKieTaskResult(
  taskId: string,
  options?: {
    timeoutMs?: number;
    intervalMs?: number;
    requestId?: string;
  }
) {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  const initialIntervalMs = options?.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const requestId = options?.requestId;
  const startedAt = Date.now();
  let pollCount = 0;
  let intervalMs = initialIntervalMs;

  if (requestId) {
    logInfo(requestId, "kie.poll.start", { taskId, timeoutMs, initialIntervalMs });
  }

  while (Date.now() - startedAt < timeoutMs) {
    pollCount += 1;
    const payload = await fetchKieRecordInfo(taskId, requestId);
    const state = payload.data?.state;

    if (requestId) {
      logInfo(requestId, "kie.poll.tick", { taskId, pollCount, state });
    }

    if (state === "success" && payload.data?.resultJson) {
      if (requestId) {
        logInfo(requestId, "kie.poll.success", { taskId, pollCount });
      }

      return payload.data.resultJson;
    }

    if (state === "fail") {
      const message =
        payload.data?.failMsg || payload.msg || "Kie task gagal diproses";

      if (requestId) {
        logError(requestId, "kie.poll.taskFailed", {
          taskId,
          failCode: payload.data?.failCode,
          failMsg: payload.data?.failMsg,
        });
      }

      throw new Error(message);
    }

    await sleep(intervalMs);
    intervalMs = Math.min(Math.round(intervalMs * 1.5), MAX_POLL_INTERVAL_MS);
  }

  if (requestId) {
    logWarn(requestId, "kie.poll.timeout", { taskId, pollCount, timeoutMs });
  }

  throw new Error("Kie task timeout — provider tidak merespons tepat waktu");
}

export function parseKieTextResult(resultJson: string): string {
  const parsed = JSON.parse(resultJson) as Record<string, unknown>;

  if (typeof parsed.resultObject === "string" && parsed.resultObject.trim()) {
    return parsed.resultObject.trim();
  }

  if (parsed.resultObject && typeof parsed.resultObject === "object") {
    const resultObject = parsed.resultObject as Record<string, unknown>;

    if (typeof resultObject.text === "string" && resultObject.text.trim()) {
      return resultObject.text.trim();
    }

    if (Array.isArray(resultObject.words)) {
      const words = resultObject.words
        .map((word) => {
          if (typeof word === "string") return word;
          if (word && typeof word === "object" && "text" in word) {
            return String((word as { text: string }).text);
          }
          return "";
        })
        .filter(Boolean);

      if (words.length > 0) {
        return words.join(" ").trim();
      }
    }
  }

  if (typeof parsed.text === "string" && parsed.text.trim()) {
    return parsed.text.trim();
  }

  throw new Error("Format hasil STT Kie AI tidak dikenali");
}

export function parseKieAudioUrl(resultJson: string): string {
  const parsed = JSON.parse(resultJson) as {
    resultUrls?: string[];
    resultObject?: { audio_url?: string; url?: string };
  };

  const url =
    parsed.resultUrls?.[0] ??
    parsed.resultObject?.audio_url ??
    parsed.resultObject?.url;

  if (!url) {
    throw new Error("URL audio TTS tidak ditemukan dalam respons Kie AI");
  }

  return url;
}

export async function downloadRemoteAudio(url: string, options?: KieRequestOptions) {
  const requestId = options?.requestId;

  const response = await withExponentialBackoff(
    () => fetch(url),
    {
      maxAttempts: POLL_FETCH_MAX_ATTEMPTS,
      baseDelayMs: POLL_FETCH_BASE_DELAY_MS,
      requestId,
      label: "kie.downloadAudio",
    }
  );

  if (!response.ok) {
    const message = `Gagal mengunduh audio TTS (${response.status})`;

    if (requestId) {
      logError(requestId, "kie.downloadAudio.failed", { status: response.status, url });
    }

    throw new Error(message);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const mimeType = response.headers.get("content-type") ?? "audio/mpeg";

  if (requestId) {
    logInfo(requestId, "kie.downloadAudio.success", { bytes: buffer.length, mimeType });
  }

  return { buffer, mimeType };
}
