import { createHash, randomUUID } from "crypto";
import path from "path";

import { storageService } from "@/features/storage/application/storage.service";

export type StoredAudioMetadata = {
  key: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

function extensionFromMimeType(mimeType: string) {
  switch (mimeType) {
    case "audio/webm":
      return ".webm";
    case "audio/mp4":
      return ".m4a";
    case "audio/wav":
      return ".wav";
    case "audio/mpeg":
    case "audio/mp3":
      return ".mp3";
    default:
      return ".bin";
  }
}

function buildTtsCacheKey(text: string, voice?: string, language?: string) {
  const hash = createHash("sha256")
    .update(`${text.trim()}|${voice ?? ""}|${language ?? ""}`)
    .digest("hex")
    .slice(0, 32);

  return `voice/ai/${hash}.mp3`;
}

export function extractStorageKeyFromMessage(message: {
  audioUrl?: string | null;
  metadata?: unknown;
}) {
  if (message.metadata && typeof message.metadata === "object") {
    const audio = (message.metadata as { audio?: { key?: string } }).audio;
    if (audio?.key) {
      return audio.key;
    }
  }

  if (!message.audioUrl) {
    return null;
  }

  const localPrefix = "/api/v1/storage/local/";
  const localIndex = message.audioUrl.indexOf(localPrefix);
  if (localIndex >= 0) {
    return decodeURIComponent(message.audioUrl.slice(localIndex + localPrefix.length));
  }

  return null;
}

export class AudioStorageService {
  buildUserVoiceKey(conversationId: string, fileName?: string, mimeType?: string) {
    const ext =
      path.extname(fileName ?? "") ||
      extensionFromMimeType(mimeType ?? "audio/webm");
    return `voice/user/${conversationId}/${randomUUID()}${ext}`;
  }

  buildAssistantVoiceKey(text: string, voice?: string, language?: string) {
    return buildTtsCacheKey(text, voice, language);
  }

  async uploadUserVoice(params: {
    conversationId: string;
    audio: Buffer;
    mimeType: string;
    fileName?: string;
    requestId?: string;
  }): Promise<StoredAudioMetadata> {
    const key = this.buildUserVoiceKey(
      params.conversationId,
      params.fileName,
      params.mimeType,
    );

    const uploaded = await storageService.upload(
      {
        key,
        body: params.audio,
        contentType: params.mimeType,
      },
      params.requestId,
    );

    return {
      key: uploaded.key,
      url: uploaded.url,
      mimeType: uploaded.contentType,
      size: uploaded.size,
      createdAt: new Date().toISOString(),
    };
  }

  async getOrCreateAssistantVoice(params: {
    text: string;
    audio: Buffer;
    mimeType: string;
    voice?: string;
    language?: string;
    requestId?: string;
  }): Promise<{ metadata: StoredAudioMetadata; cached: boolean }> {
    const key = this.buildAssistantVoiceKey(
      params.text,
      params.voice,
      params.language,
    );

    if (await storageService.exists(key)) {
      const url = process.env.AWS_PUBLIC_URL?.trim()
        ? storageService.getPublicUrl(key)
        : await storageService.getSignedUrl(key, 60 * 60 * 24 * 7, params.requestId);

      return {
        cached: true,
        metadata: {
          key,
          url,
          mimeType: params.mimeType,
          size: 0,
          createdAt: new Date().toISOString(),
        },
      };
    }

    const uploaded = await storageService.upload(
      {
        key,
        body: params.audio,
        contentType: params.mimeType,
      },
      params.requestId,
    );

    return {
      cached: false,
      metadata: {
        key: uploaded.key,
        url: uploaded.url,
        mimeType: uploaded.contentType,
        size: uploaded.size,
        createdAt: new Date().toISOString(),
      },
    };
  }
}

export const audioStorageService = new AudioStorageService();
