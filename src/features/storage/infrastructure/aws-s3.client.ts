import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function getBucketName() {
  return (
    process.env.AWS_BUCKET?.trim() ||
    process.env.AWS_S3_BUCKET?.trim() ||
    getRequiredEnv("AWS_BUCKET")
  );
}

export class AwsS3Client {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;

  constructor() {
    this.bucket = getBucketName();
    this.prefix = (process.env.AWS_S3_PREFIX ?? "").replace(/^\/+|\/+$/g, "");
    this.client = new S3Client({
      region: getRequiredEnv("AWS_REGION"),
      credentials: {
        accessKeyId: getRequiredEnv("AWS_ACCESS_KEY_ID"),
        secretAccessKey: getRequiredEnv("AWS_SECRET_ACCESS_KEY"),
      },
    });
  }

  resolveKey(key: string) {
    const normalized = key.replace(/^\/+/, "");
    return this.prefix ? `${this.prefix}/${normalized}` : normalized;
  }

  async uploadObject(params: {
    key: string;
    body: Buffer | Uint8Array;
    contentType: string;
  }) {
    const objectKey = this.resolveKey(params.key);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: params.body,
        ContentType: params.contentType,
      }),
    );

    return {
      key: params.key,
      objectKey,
      size: params.body.byteLength,
    };
  }

  async downloadObject(key: string) {
    const objectKey = this.resolveKey(key);
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      }),
    );

    const body = response.Body;
    if (!body) {
      throw new Error("S3 object body kosong");
    }

    return Buffer.from(await body.transformToByteArray());
  }

  async deleteObject(key: string) {
    const objectKey = this.resolveKey(key);
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      }),
    );
  }

  async objectExists(key: string) {
    try {
      const objectKey = this.resolveKey(key);
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  getPublicObjectUrl(key: string) {
    const publicBase = process.env.AWS_PUBLIC_URL?.replace(/\/+$/, "");
    const objectKey = this.resolveKey(key);

    if (publicBase) {
      return `${publicBase}/${objectKey.split("/").map(encodeURIComponent).join("/")}`;
    }

    const region = getRequiredEnv("AWS_REGION");
    return `https://${this.bucket}.s3.${region}.amazonaws.com/${objectKey
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
  }

  async createSignedUrl(key: string, expiresInSeconds = 900) {
    const objectKey = this.resolveKey(key);
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      }),
      { expiresIn: expiresInSeconds },
    );
  }
}
