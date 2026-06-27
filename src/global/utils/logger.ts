type LogLevel = "info" | "warn" | "error";

type LogMeta = Record<string, unknown>;

function writeLog(level: LogLevel, requestId: string, message: string, meta?: LogMeta) {
  const payload = {
    level,
    requestId,
    message,
    ...(meta ?? {}),
    ts: new Date().toISOString(),
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export function logInfo(requestId: string, message: string, meta?: LogMeta) {
  writeLog("info", requestId, message, meta);
}

export function logWarn(requestId: string, message: string, meta?: LogMeta) {
  writeLog("warn", requestId, message, meta);
}

export function logError(requestId: string, message: string, meta?: LogMeta) {
  writeLog("error", requestId, message, meta);
}
