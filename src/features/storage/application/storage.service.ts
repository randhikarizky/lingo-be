import { isMockStorageEnabled } from "@/global/config/mock.config";
import { logError, logInfo } from "@/global/utils/logger";
import { logStorageAnalyticsEvent } from "@/features/storage/application/storage.analytics";
import { LocalStorageProvider } from "@/features/storage/data/providers/local-storage.provider";
import { S3StorageProvider } from "@/features/storage/data/providers/s3-storage.provider";
import type {
  StorageProvider,
  StorageUploadInput,
  StorageUploadResult,
} from "@/features/storage/domain/ports/storage-provider.interface";

const UPLOAD_RETRY_COUNT = 2;
const DEFAULT_SIGNED_URL_TTL_SECONDS = 900;

function resolveStorageProviderName() {
  if (isMockStorageEnabled()) {
    return "local";
  }

  const provider = (
    process.env.STORAGE_PROVIDER ??
    process.env.STORAGE_DRIVER ??
    "local"
  ).trim();

  return provider === "s3" ? "s3" : "local";
}

function createProvider(): StorageProvider {
  return resolveStorageProviderName() === "s3"
    ? new S3StorageProvider()
    : new LocalStorageProvider();
}

export class StorageService {
  private provider: StorageProvider | null = null;

  getProviderName() {
    return resolveStorageProviderName();
  }

  private getProvider() {
    if (!this.provider) {
      this.provider = createProvider();
    }
    return this.provider;
  }

  async upload(
    input: StorageUploadInput,
    requestId = "storage",
  ): Promise<StorageUploadResult> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= UPLOAD_RETRY_COUNT; attempt += 1) {
      try {
        const result = await this.getProvider().upload(input);
        logInfo(requestId, "UPLOAD_SUCCESS", {
          key: result.key,
          size: result.size,
          provider: this.getProviderName(),
        });
        logStorageAnalyticsEvent("storage_upload", {
          key: result.key,
          size: result.size,
          provider: this.getProviderName(),
        });
        return result;
      } catch (error) {
        lastError = error;
        logError(requestId, "UPLOAD_FAILED", {
          key: input.key,
          attempt: attempt + 1,
          provider: this.getProviderName(),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Upload gagal setelah beberapa percobaan");
  }

  async download(key: string, requestId = "storage"): Promise<Buffer> {
    try {
      const buffer = await this.getProvider().download(key);
      logStorageAnalyticsEvent("storage_download", { key });
      return buffer;
    } catch (error) {
      logError(requestId, "storage.download.failed", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async delete(key: string, requestId = "storage"): Promise<void> {
    try {
      await this.getProvider().delete(key);
      logInfo(requestId, "DELETE_SUCCESS", { key });
      logStorageAnalyticsEvent("storage_delete", { key });
    } catch (error) {
      logError(requestId, "DELETE_FAILED", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async deleteSafe(key: string, requestId = "storage") {
    try {
      await this.delete(key, requestId);
    } catch {
      // Storage cleanup tidak boleh memblokir business flow.
    }
  }

  exists(key: string) {
    return this.getProvider().exists(key);
  }

  getPublicUrl(key: string) {
    return this.getProvider().getPublicUrl(key);
  }

  async getSignedUrl(
    key: string,
    expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS,
    requestId = "storage",
  ) {
    const url = await this.getProvider().getSignedUrl(key, expiresInSeconds);
    logStorageAnalyticsEvent("storage_signed_url", {
      key,
      expiresInSeconds,
    });
    logInfo(requestId, "storage.signed_url", { key, expiresInSeconds });
    return url;
  }
}

export const storageService = new StorageService();
