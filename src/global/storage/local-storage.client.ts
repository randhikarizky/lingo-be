import { mkdir, writeFile, unlink, readFile } from "fs/promises";
import path from "path";

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

export class LocalStorageClient {
  async upload(params: {
    key: string;
    body: Buffer | Uint8Array;
    contentType: string;
  }) {
    const filePath = resolveLocalPath(params.key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, params.body);

    const baseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";
    const encodedKey = params.key.split("/").map(encodeURIComponent).join("/");

    return {
      url: `${baseUrl}/api/v1/storage/local/${encodedKey}`,
      key: params.key,
      contentType: params.contentType,
      mock: true as const,
    };
  }

  async deleteObject(key: string) {
    const filePath = resolveLocalPath(key);
    await unlink(filePath);
  }

  async readObject(key: string) {
    const filePath = resolveLocalPath(key);
    return readFile(filePath);
  }

  resolvePath(key: string) {
    return resolveLocalPath(key);
  }
}

export const localStorageClient = new LocalStorageClient();
