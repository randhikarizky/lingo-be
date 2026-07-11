import { LocalStorageProvider } from "@/features/storage/data/providers/local-storage.provider";

/** @deprecated Gunakan storageService / LocalStorageProvider */
const localProvider = new LocalStorageProvider();

export class LocalStorageClient {
  upload(params: {
    key: string;
    body: Buffer | Uint8Array;
    contentType: string;
  }) {
    return localProvider.upload(params);
  }

  deleteObject(key: string) {
    return localProvider.delete(key);
  }

  readObject(key: string) {
    return localProvider.download(key);
  }

  resolvePath(key: string) {
    return key;
  }
}

export const localStorageClient = new LocalStorageClient();
