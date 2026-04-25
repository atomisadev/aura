import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import type { Readable } from "node:stream";

const normalizeFilename = (filename: string) =>
  filename
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "audio";

const buildPublicUrl = (key: string) => {
  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL;

  if (!publicBaseUrl) {
    return null;
  }

  return `${publicBaseUrl.replace(/\/$/, "")}/${key}`;
};

export async function uploadAudioStream({
  userId,
  filename,
  contentType,
  body,
}: {
  userId: string;
  filename: string;
  contentType: string;
  body: Readable;
}) {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION ?? "auto";
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true";

  if (!bucket) {
    throw new Error("S3_BUCKET is required.");
  }

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required.");
  }

  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const key = `uploads/${userId}/${Date.now()}-${normalizeFilename(filename)}`;

  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    },
  });

  await upload.done();

  return {
    bucket,
    key,
    url: buildPublicUrl(key),
  };
}
