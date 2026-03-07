import sharp from "sharp";
import { openRouterClient } from "@/lib/clients/openrouter";
import { replicateRun } from "@/lib/clients/replicate";
import { upload } from "@/lib/clients/storage";
import {
  getProject,
  getGenerations,
  updateProjectThumbnail,
  type Project,
} from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RECRAFT_V4_MODEL_ID = "recraft-ai/recraft-v4";
const THUMBNAIL_LLM_MODEL = "google/gemini-2.0-flash-001";
const THUMBNAIL_TIMEOUT_MS = 15_000;
const THUMBNAIL_SIZE = 512;
const GENERATION_SIZE = 1024;
const MAX_PROMPTS_FOR_REFRESH = 10;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Call OpenRouter with a system prompt and user message to get a thumbnail
 * image generation prompt. Uses a 15s timeout (low-priority call).
 */
async function generateImagePromptFromLLM(userMessage: string): Promise<string> {
  const systemPrompt =
    "You are an expert AI image prompt writer. " +
    "Given a project name or a list of image prompts, generate a single concise and vivid image generation prompt " +
    "(max 150 words) that would make a representative, visually interesting thumbnail. " +
    "Output ONLY the prompt text, nothing else.";

  return openRouterClient.chat({
    model: THUMBNAIL_LLM_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    timeout: THUMBNAIL_TIMEOUT_MS,
  });
}

/**
 * Generate a 1024x1024 image via Replicate Recraft V4, resize to 512x512 PNG
 * via Sharp, and upload to R2 under `thumbnails/{projectId}.png`.
 * Returns the public R2 URL.
 */
async function generateAndUploadThumbnail(
  projectId: string,
  imagePrompt: string
): Promise<string> {
  // 1. Call Replicate Recraft V4 at 1024x1024
  const result = await replicateRun(RECRAFT_V4_MODEL_ID, {
    prompt: imagePrompt,
    width: GENERATION_SIZE,
    height: GENERATION_SIZE,
  });

  // 2. Read stream into buffer
  const reader = result.output.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const rawBuffer = Buffer.concat(chunks);

  // 3. Resize to 512x512 PNG via Sharp
  const resizedBuffer = await sharp(rawBuffer)
    .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: "cover" })
    .png()
    .toBuffer();

  // 4. Upload to R2 at thumbnails/{projectId}.png
  const key = `thumbnails/${projectId}.png`;
  const publicUrl = await upload(resizedBuffer as unknown as Buffer, key);

  return publicUrl;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a thumbnail for a project based on the project name.
 * Sets thumbnail_status to 'pending' immediately, then runs the full
 * LLM -> Replicate -> Sharp -> R2 -> DB flow fire-and-forget.
 *
 * AC-1, AC-2, AC-3, AC-4, AC-5
 */
export async function generateForProject(projectId: string): Promise<void> {
  // AC-1: Set status to pending before any external API calls
  await updateProjectThumbnail({
    projectId,
    thumbnailUrl: null,
    thumbnailStatus: "pending",
  });

  try {
    // Fetch project name for the LLM prompt
    const project: Project = await getProject(projectId);

    // AC-2: Call OpenRouter to generate a thumbnail image prompt from project name
    const userMessage = `Project name: "${project.name}". Generate a representative thumbnail image prompt.`;
    const imagePrompt = await generateImagePromptFromLLM(userMessage);

    // AC-2 continued + AC-3: Generate image via Recraft V4, resize, upload
    const thumbnailUrl = await generateAndUploadThumbnail(projectId, imagePrompt);

    // AC-4: Update DB with completed status and URL
    await updateProjectThumbnail({
      projectId,
      thumbnailUrl,
      thumbnailStatus: "completed",
    });
  } catch (error) {
    // AC-5: On any error, set status to failed and log — do NOT throw
    console.error(`[ThumbnailService] generateForProject(${projectId}) failed:`, error);
    try {
      await updateProjectThumbnail({
        projectId,
        thumbnailUrl: null,
        thumbnailStatus: "failed",
      });
    } catch (dbError) {
      console.error(
        `[ThumbnailService] Could not set failed status for project ${projectId}:`,
        dbError
      );
    }
  }
}

/**
 * Refresh the thumbnail for a project by analysing its recent generations.
 * If the project has no generations, falls back to generateForProject.
 *
 * AC-6, AC-7
 */
export async function refreshForProject(projectId: string): Promise<void> {
  try {
    // AC-6: Load last 10 prompts for the project (inside try so DB errors are caught)
    const generationRows = await getGenerations(projectId);

    if (generationRows.length === 0) {
      // AC-7: No generations — fall back to project-name based generation
      return generateForProject(projectId);
    }

    // AC-1 (same as generateForProject): Set status to pending before external calls
    await updateProjectThumbnail({
      projectId,
      thumbnailUrl: null,
      thumbnailStatus: "pending",
    });

    // Take the latest MAX_PROMPTS_FOR_REFRESH prompts
    const recentPrompts = generationRows
      .slice(0, MAX_PROMPTS_FOR_REFRESH)
      .map((g) => g.prompt);

    // AC-6: Send prompts to LLM for a representative thumbnail prompt
    const userMessage =
      `Based on the following image prompts from a project, generate a single representative thumbnail image prompt:\n` +
      recentPrompts.map((p, i) => `${i + 1}. ${p}`).join("\n");

    const imagePrompt = await generateImagePromptFromLLM(userMessage);

    // Generate image, resize, upload
    const thumbnailUrl = await generateAndUploadThumbnail(projectId, imagePrompt);

    // Update DB with completed status and URL
    await updateProjectThumbnail({
      projectId,
      thumbnailUrl,
      thumbnailStatus: "completed",
    });
  } catch (error) {
    // AC-5: On any error (incl. getGenerations DB errors), set status to failed and log — do NOT throw
    console.error(`[ThumbnailService] refreshForProject(${projectId}) failed:`, error);
    try {
      await updateProjectThumbnail({
        projectId,
        thumbnailUrl: null,
        thumbnailStatus: "failed",
      });
    } catch (dbError) {
      console.error(
        `[ThumbnailService] Could not set failed status for project ${projectId}:`,
        dbError
      );
    }
  }
}
