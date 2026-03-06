import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

interface StorageConfig {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  publicUrl: string;
  bucket: string;
}

function getConfig(): StorageConfig {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT;
  const publicUrl = process.env.R2_PUBLIC_URL;
  const bucket = process.env.R2_BUCKET_NAME ?? process.env.R2_BUCKET;

  const missing: string[] = [];
  if (!accessKeyId) missing.push("R2_ACCESS_KEY_ID");
  if (!secretAccessKey) missing.push("R2_SECRET_ACCESS_KEY");
  if (!endpoint) missing.push("R2_ENDPOINT");
  if (!publicUrl) missing.push("R2_PUBLIC_URL");

  if (missing.length > 0) {
    throw new Error(
      `Fehlende Umgebungsvariablen: ${missing.join(", ")}. Bitte in .env konfigurieren.`
    );
  }

  if (!bucket) {
    throw new Error(
      "Fehlende Umgebungsvariable: R2_BUCKET_NAME oder R2_BUCKET. Bitte in .env konfigurieren."
    );
  }

  return {
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    endpoint: endpoint!,
    publicUrl: publicUrl!.replace(/\/+$/, ""), // Remove trailing slashes
    bucket,
  };
}

function createS3Client(config: StorageConfig): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

async function streamToBuffer(
  stream: ReadableStream | Buffer
): Promise<Buffer> {
  if (Buffer.isBuffer(stream)) {
    return stream;
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  return Buffer.concat(chunks);
}

export async function upload(
  stream: ReadableStream | Buffer,
  key: string
): Promise<string> {
  const config = getConfig();
  const client = createS3Client(config);

  let body: Buffer;
  try {
    body = await streamToBuffer(stream);
  } catch (error: unknown) {
    throw new Error(
      `Fehler beim Lesen des Streams: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: body,
        ContentType: "image/png",
      })
    );
  } catch (error: unknown) {
    throw new Error(
      `R2 Upload fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }

  return `${config.publicUrl}/${key}`;
}

export async function deleteObject(key: string): Promise<void> {
  const config = getConfig();
  const client = createS3Client(config);

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: key,
      })
    );
  } catch (error: unknown) {
    throw new Error(
      `R2 Delete fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}

// Named export object for consumers that prefer object-style access
export const StorageService = {
  upload,
  delete: deleteObject,
};
