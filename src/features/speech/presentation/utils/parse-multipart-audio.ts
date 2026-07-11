import { MAX_AUDIO_SIZE_BYTES } from "@/features/speech/domain/constants/mock-transcripts";

export type ParsedTranscribeForm = {
  audio: {
    buffer: Buffer;
    mimeType: string;
    size: number;
    fileName: string;
  };
  language?: string;
  conversationId?: string;
};

export class TranscribeValidationError extends Error {
  status: number;

  constructor(message: string, status = 422) {
    super(message);
    this.name = "TranscribeValidationError";
    this.status = status;
  }
}

const ALLOWED_MIME_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/aac",
  "audio/x-m4a",
  "audio/m4a",
  "video/mp4",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".webm",
  ".mp4",
  ".m4a",
  ".mp3",
  ".wav",
  ".ogg",
  ".aac",
]);

function normalizeMimeType(mimeType: string) {
  return mimeType.split(";")[0].trim().toLowerCase();
}

function hasAllowedExtension(fileName: string) {
  const lower = fileName.toLowerCase();
  return [...ALLOWED_EXTENSIONS].some((ext) => lower.endsWith(ext));
}

function isAllowedMimeType(mimeType: string, fileName: string) {
  const normalized = normalizeMimeType(mimeType);

  if (ALLOWED_MIME_TYPES.has(normalized)) {
    return true;
  }

  if (
    normalized === "application/octet-stream" &&
    hasAllowedExtension(fileName)
  ) {
    return true;
  }

  return false;
}

function parseOptionalField(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function parseTranscribeMultipart(
  request: Request,
): Promise<ParsedTranscribeForm> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("multipart/form-data")) {
    throw new TranscribeValidationError(
      "Content-Type harus multipart/form-data",
      415,
    );
  }

  const formData = await request.formData();
  const audioEntry = formData.get("audio");

  if (!audioEntry || !(audioEntry instanceof File)) {
    throw new TranscribeValidationError("Field audio wajib berupa file", 422);
  }

  if (audioEntry.size === 0) {
    throw new TranscribeValidationError("File audio tidak boleh kosong", 422);
  }

  if (audioEntry.size > MAX_AUDIO_SIZE_BYTES) {
    throw new TranscribeValidationError("File audio melebihi batas 10MB", 422);
  }

  const mimeType = normalizeMimeType(
    audioEntry.type || "application/octet-stream",
  );
  const fileName = audioEntry.name || "recording.webm";

  if (!isAllowedMimeType(mimeType, fileName)) {
    throw new TranscribeValidationError(
      `Format audio tidak didukung: ${mimeType}. Gunakan webm, mp4, m4a, mp3, wav, atau ogg.`,
      422,
    );
  }

  const buffer = Buffer.from(await audioEntry.arrayBuffer());

  return {
    audio: {
      buffer,
      mimeType,
      size: audioEntry.size,
      fileName,
    },
    language: parseOptionalField(formData.get("language")),
    conversationId: parseOptionalField(formData.get("conversationId")),
  };
}
