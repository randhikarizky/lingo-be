import {
  PutObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { isMockStorageEnabled } from "../config/mock.config";
import { localStorageClient } from "./local-storage.client";

const bucket = process.env.AWS_S3_BUCKET ?? "";
const region = process.env.AWS_REGION ?? "ap-southeast-1";

const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  },
});

export type UploadResult = {
  url: string;
  key: string;
  mock: boolean;
};

export class S3StorageClient {
  isMockMode() {
    return isMockStorageEnabled();
  }

  async uploadRecording(params: {
    key: string;
    body: Buffer | Uint8Array;
    contentType: string;
  }): Promise<UploadResult> {
    if (isMockStorageEnabled()) {
      const result = await localStorageClient.upload(params);
      return {
        url: result.url,
        key: result.key,
        mock: true,
      };
    }

    if (!bucket) {
      throw new Error("AWS_S3_BUCKET belum dikonfigurasi");
    }

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
      })
    );

    return {
      url: `https://${bucket}.s3.${region}.amazonaws.com/${params.key}`,
      key: params.key,
      mock: false,
    };
  }

  async deleteObject(key: string) {
    if (isMockStorageEnabled()) {
      await localStorageClient.deleteObject(key);
      return;
    }

    if (!bucket) {
      throw new Error("AWS_S3_BUCKET belum dikonfigurasi");
    }

    await s3.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
  }

  async getUploadUrl(key: string, contentType: string, expiresIn = 3600) {
    if (isMockStorageEnabled()) {
      const baseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";
      return `${baseUrl}/api/v1/storage/upload?key=${encodeURIComponent(key)}&contentType=${encodeURIComponent(contentType)}`;
    }

    if (!bucket) {
      throw new Error("AWS_S3_BUCKET belum dikonfigurasi");
    }

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(s3, command, { expiresIn });
  }
}

export const s3StorageClient = new S3StorageClient();

export function buildRecordingKey(
  userId: string,
  conversationId: string,
  filename: string
) {
  return `recordings/${userId}/${conversationId}/${filename}`;
}
