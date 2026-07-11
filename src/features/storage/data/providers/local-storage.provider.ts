import { access, mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

import type {
  StorageProvider,
  StorageUploadInput,
  StorageUploadResult,
} from "@/features/storage/domain/ports/storage-provider.interface";

function getStorageRoot() {
  return process.env.LOCAL_STORAGE_DIR ?? ".local-storage";
}

function resolveLocalPath(key: string) {
  const root = path.resolve(getStorageRoot());
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  const fullPath = path.resolve(root, normalized);

  if (!fullPath.startsWith(root)) {
    throw new Error("Invalid storage key");
  }

  return fullPath;
}

export class LocalStorageProvider implements StorageProvider {
  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    const filePath = resolveLocalPath(input.key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, input.body);

    const baseUrl = process.env.API_BASE_URL ?? "http://localhost:4626";
    const encodedKey = input.key.split("/").map(encodeURIComponent).join("/");

    return {
      key: input.key,
      url: `${baseUrl}/api/v1/storage/local/${encodedKey}`,
      contentType: input.contentType,
      size: input.body.byteLength,
    };
  }

  async download(key: string): Promise<Buffer> {
    return readFile(resolveLocalPath(key));
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(resolveLocalPath(key));
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        return;
      }
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(resolveLocalPath(key));
      return true;
    } catch {
      return false;
    }
  }

  getPublicUrl(key: string): string {
    const baseUrl = process.env.API_BASE_URL ?? "http://localhost:4626";
    const encodedKey = key.split("/").map(encodeURIComponent).join("/");
    return `${baseUrl}/api/v1/storage/local/${encodedKey}`;
  }

  async getSignedUrl(key: string): Promise<string> {
    return this.getPublicUrl(key);
  }
}
