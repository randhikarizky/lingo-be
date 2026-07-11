import type {
  StorageProvider,
  StorageUploadInput,
  StorageUploadResult,
} from "@/features/storage/domain/ports/storage-provider.interface";
import { AwsS3Client } from "@/features/storage/infrastructure/aws-s3.client";

const DEFAULT_SIGNED_URL_TTL_SECONDS = 900;

export class S3StorageProvider implements StorageProvider {
  private readonly client: AwsS3Client;

  constructor(client = new AwsS3Client()) {
    this.client = client;
  }

  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    const uploaded = await this.client.uploadObject({
      key: input.key,
      body: input.body,
      contentType: input.contentType,
    });

    const url = process.env.AWS_PUBLIC_URL?.trim()
      ? this.getPublicUrl(input.key)
      : await this.getSignedUrl(input.key, 60 * 60 * 24 * 7);

    return {
      key: input.key,
      url,
      contentType: input.contentType,
      size: uploaded.size,
    };
  }

  async download(key: string): Promise<Buffer> {
    return this.client.downloadObject(key);
  }

  async delete(key: string): Promise<void> {
    await this.client.deleteObject(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.client.objectExists(key);
  }

  getPublicUrl(key: string): string {
    return this.client.getPublicObjectUrl(key);
  }

  async getSignedUrl(
    key: string,
    expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS,
  ): Promise<string> {
    return this.client.createSignedUrl(key, expiresInSeconds);
  }
}
