import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

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

const shouldUseLocalFallback = () =>
  process.env.ALLOW_LOCAL_UPLOAD_FALLBACK === "true";

const saveAudioLocally = async ({
  key,
  body,
}: {
  key: string;
  body: Uint8Array;
}) => {
  const uploadRoot = resolve(
    process.cwd(),
    process.env.LOCAL_UPLOAD_DIR ?? ".",
  );
  const filePath = resolve(uploadRoot, key);

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, body);

  const publicBaseUrl = process.env.LOCAL_UPLOAD_BASE_URL;

  return {
    bucket: "local-dev",
    key,
    url: publicBaseUrl ? `${publicBaseUrl.replace(/\/$/, "")}/${key}` : null,
  };
};

export async function uploadAudioStream({
  userId,
  filename,
  contentType,
  body,
  contentLength,
}: {
  userId: string;
  filename: string;
  contentType: string;
  body: Uint8Array;
  contentLength: number;
}) {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION ?? "auto";
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true";

  const key = `uploads/${userId}/${Date.now()}-${normalizeFilename(filename)}`;

  try {
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
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentLength: contentLength,
      }),
    );

    return {
      bucket,
      key,
      url: buildPublicUrl(key),
    };
  } catch (error) {
    if (endpoint?.includes("backblazeb2.com")) {
      const err = error as { message?: string; Code?: string };

      if (err.Code === "IncompleteBody") {
        throw new Error(
          "Backblaze rejected the upload. The configured S3 key/secret or endpoint is likely invalid for writes. Create a new Backblaze application key with `writeFiles` permission for this bucket and update the backend `.env`.",
        );
      }
    }

    if (!shouldUseLocalFallback()) {
      throw error;
    }

    console.error("Object storage upload failed, using local fallback.", error);

    return saveAudioLocally({
      key,
      body,
    });
  }
}
