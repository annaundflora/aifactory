import Replicate from "replicate";

export interface ReplicateRunResult {
  output: ReadableStream;
  predictionId: string;
  seed: number | null;
}

function getClient(): Replicate {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error(
      "REPLICATE_API_TOKEN ist nicht gesetzt. Bitte in .env konfigurieren."
    );
  }
  return new Replicate({ auth: token });
}

export async function replicateRun(
  modelId: string,
  input: Record<string, unknown>
): Promise<ReplicateRunResult> {
  const client = getClient();

  let prediction;
  try {
    prediction = await client.predictions.create({
      model: modelId,
      input,
    });
  } catch (error: unknown) {
    if (isRateLimitError(error)) {
      throw new Error("Zu viele Anfragen. Bitte kurz warten.");
    }
    throw new Error(
      `Replicate API Fehler: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  try {
    prediction = await client.wait(prediction);
  } catch (error: unknown) {
    if (isRateLimitError(error)) {
      throw new Error("Zu viele Anfragen. Bitte kurz warten.");
    }
    throw new Error(
      `Replicate API Fehler beim Warten: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (prediction.status === "failed") {
    throw new Error(
      `Replicate Generation fehlgeschlagen: ${prediction.error ?? "Unbekannter Fehler"}`
    );
  }

  const output = prediction.output;
  if (!output) {
    throw new Error("Replicate lieferte kein Output.");
  }

  // Extract seed from prediction logs if available
  const seed = extractSeed(prediction.logs);

  // The output from Replicate can be a FileOutput (ReadableStream) or an array of FileOutput
  // For image models, output is typically a single FileOutput or an array with one element
  const fileOutput = Array.isArray(output) ? output[0] : output;

  // FileOutput implements ReadableStream - convert to a proper ReadableStream if needed
  let stream: ReadableStream;
  if (fileOutput instanceof ReadableStream) {
    stream = fileOutput;
  } else if (typeof fileOutput === "string") {
    // Legacy URL mode - fetch the URL to get a stream
    const response = await fetch(fileOutput);
    if (!response.ok || !response.body) {
      throw new Error(`Konnte Replicate Output nicht laden: ${fileOutput}`);
    }
    stream = response.body;
  } else if (
    fileOutput &&
    typeof fileOutput === "object" &&
    "url" in fileOutput
  ) {
    // FileOutput object with url() method
    const url =
      typeof (fileOutput as { url: () => string }).url === "function"
        ? (fileOutput as { url: () => string }).url()
        : String((fileOutput as { url: string }).url);
    const response = await fetch(url);
    if (!response.ok || !response.body) {
      throw new Error(`Konnte Replicate Output nicht laden: ${url}`);
    }
    stream = response.body;
  } else {
    throw new Error("Unerwartetes Replicate Output-Format.");
  }

  return {
    output: stream,
    predictionId: prediction.id,
    seed,
  };
}

function isRateLimitError(error: unknown): boolean {
  if (error && typeof error === "object") {
    if ("status" in error && (error as { status: number }).status === 429) {
      return true;
    }
    if (
      "response" in error &&
      (error as { response: { status: number } }).response?.status === 429
    ) {
      return true;
    }
  }
  return false;
}

function extractSeed(logs: string | null | undefined): number | null {
  if (!logs) return null;
  // Common patterns in Replicate logs for seed
  const seedMatch = logs.match(/(?:seed|random_seed|Random seed)[:\s=]+(\d+)/i);
  if (seedMatch) {
    const parsed = parseInt(seedMatch[1], 10);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

// Named export object for consumers that prefer object-style access
export const ReplicateClient = {
  run: replicateRun,
};
