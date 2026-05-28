import { S3Client, DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET_NAME ?? "exploreus-media";
const publicUrl = process.env.R2_PUBLIC_URL ?? "";

export function hasR2(): boolean {
  return Boolean(accountId && accessKeyId && secretAccessKey);
}

let client: S3Client | null = null;
export function getClient(): S3Client {
  if (!hasR2()) throw new Error("R2 not configured — set R2_* env vars in .env.local");
  if (client) return client;
  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
    },
  });
  return client;
}

export const BUCKET = bucket;

// Returns a presigned PUT URL the client can use to upload directly to R2.
export async function presignPutUrl(key: string, contentType: string): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(getClient(), cmd, { expiresIn: 600 }); // 10 min
}

export function publicUrlFor(key: string): string {
  if (!publicUrl) return "";
  return `${publicUrl.replace(/\/$/, "")}/${key}`;
}

export async function deleteObject(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
