export type StorageUploadInput = {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
  isPublic?: boolean;
};

export type StorageUploadResult = {
  key: string;
  url: string;
  contentType: string;
  size: number;
};

export interface StorageProvider {
  upload(input: StorageUploadInput): Promise<StorageUploadResult>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getPublicUrl(key: string): string;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}
