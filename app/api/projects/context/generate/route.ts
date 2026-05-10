/**
 * POST /api/projects/context/generate
 *
 * HTTP boundary for the "Help me write this" Helper-Modal (Slice 09). One-shot
 * call to OpenRouter that drafts a project-context block from a short user
 * brief. The endpoint is auth-required but **NOT** project-bound: it returns
 * text only and never touches the DB. Persisting the draft is the caller's
 * responsibility (PATCH /api/projects/{id}/context or the corresponding
 * server action).
 *
 * Auth: Auth.js session cookie via `requireAuth()` (architecture.md → Section
 *       "Authentication & Authorization", Zeile 355 + 359).
 * Validation: inline type-guards (no Zod — repo convention); `brief` length
 *             10..500 post-trim per architecture.md Zeile 338.
 * LLM: single `openRouterClient.chat({ model, messages })` call with the
 *      default model `anthropic/claude-sonnet-4.6` (architecture.md Zeile
 *      576). No streaming, no second call.
 * Status mapping: 401 (auth) / 200 (success) / 422 (validation) / 502
 *                 (OpenRouter failure) — no 400/403/500.
 * Runtime: nodejs (consistent with sibling routes that touch
 *          process.env / TCP-based clients).
 */

import { requireAuth } from "@/lib/auth/guard";
import { openRouterClient } from "@/lib/clients/openrouter";

// Force Node.js runtime — keep parity with sibling project-context routes
// (postgres-js / OpenRouter client both rely on Node-only globals).
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default chat LLM for the helper path (architecture.md Zeile 576). */
const HELPER_MODEL = "anthropic/claude-sonnet-4.6";

/** Brief input length bounds (post-trim) — architecture.md Zeile 338. */
const BRIEF_MIN_LENGTH = 10;
const BRIEF_MAX_LENGTH = 500;

/** Draft cap mirrors the DTO contract (architecture.md Zeile 144). */
const DRAFT_MAX_LENGTH = 8000;

// Wortlaut exakt aus architecture.md → "Validation Rules" (Zeile 338) +
// "Error Handling Strategy" (Zeile 492) — i18n-Konsistenz mit Frontend-Modal.
const ERROR_BRIEF_LENGTH =
  "Please describe your project briefly (10–500 characters).";
const ERROR_INVALID_BODY = "Invalid request body";
const ERROR_GENERATE_FAILED = "Could not generate. Try again.";
const ERROR_UNAUTHORIZED = "Unauthorized";

/**
 * System message instructs the LLM to draft a compact, descriptive
 * project-context block (≤ 8000 chars) for a *future* image-generation
 * assistant session. The block must read as metadata (subject / aesthetic /
 * avoid hints) — never as commands or instructions to a downstream model.
 * See wireframes.md Zeile 326-334 for the expected output shape.
 */
const HELPER_SYSTEM_PROMPT = `You are helping a user draft a "project context" block for an AI image generation assistant. The block describes the project's recurring subject, aesthetic, and constraints so the assistant can stay on-brand across many generations within the project.

Rules for your output:
- Output ONLY the project-context text. No preface, no markdown headings, no closing remarks, no quotes.
- Keep it descriptive metadata, NOT instructions. Use phrasing like "Project subject: …", "Aesthetic: …", "Avoid: …", "Medium / Style: …" — never imperative commands like "Generate …" or "Always do …".
- Cover the dimensions that are present in the brief: subject, aesthetic / style, medium, palette / lighting cues, composition hints, and explicit avoid-list.
- If the brief is sparse, infer reasonable specifics from the user's domain words; do not invent unrelated facts.
- Stay concise. Aim for 80–600 words; never exceed 8000 characters total. Plain text, no fences, no JSON.
- Write in English unless the brief is clearly in another language; in that case mirror the brief's language.`;

// ---------------------------------------------------------------------------
// Body validation (no Zod — inline type guards, matching repo convention)
// ---------------------------------------------------------------------------

type GenerateBody = { brief: string };

function isGenerateBody(value: unknown): value is GenerateBody {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("brief" in value)) {
    return false;
  }
  return typeof (value as { brief: unknown }).brief === "string";
}

// ---------------------------------------------------------------------------
// POST /api/projects/context/generate
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // 1. Auth (architecture.md Zeile 355 — auth required, no project binding)
  const authResult = await requireAuth();
  if ("error" in authResult) {
    return Response.json({ error: ERROR_UNAUTHORIZED }, { status: 401 });
  }

  // 2. Parse + validate body (no LLM call before validation passes)
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    // Privacy: do not log the (potentially partial) body on parse failure.
    console.debug("[context/generate] invalid JSON body");
    return Response.json({ error: ERROR_INVALID_BODY }, { status: 422 });
  }

  if (!isGenerateBody(parsed)) {
    console.debug("[context/generate] body missing string `brief`");
    return Response.json({ error: ERROR_INVALID_BODY }, { status: 422 });
  }

  // 3. Trim + length-check (architecture.md Zeile 338).
  //    The trimmed `brief` is forwarded to OpenRouter — never the raw input.
  const trimmedBrief = parsed.brief.trim();
  if (
    trimmedBrief.length < BRIEF_MIN_LENGTH ||
    trimmedBrief.length > BRIEF_MAX_LENGTH
  ) {
    console.debug(
      `[context/generate] brief length ${trimmedBrief.length} outside [${BRIEF_MIN_LENGTH}, ${BRIEF_MAX_LENGTH}]`,
    );
    return Response.json({ error: ERROR_BRIEF_LENGTH }, { status: 422 });
  }

  // 4. Single LLM call — default model, default timeout (30s from
  //    `lib/clients/openrouter.ts:29`). No streaming, no retry loop.
  let draft: string;
  try {
    draft = await openRouterClient.chat({
      model: HELPER_MODEL,
      messages: [
        { role: "system", content: HELPER_SYSTEM_PROMPT },
        { role: "user", content: trimmedBrief },
      ],
    });
  } catch (err) {
    // Architecture.md Zeile 492: error log w/ correlation hint, 502 mapping.
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[context/generate] OpenRouter call failed for user=${authResult.userId}: ${message}`,
    );
    return Response.json({ error: ERROR_GENERATE_FAILED }, { status: 502 });
  }

  // 5. Defence-in-depth: cap draft length at the DTO contract (architecture
  //    .md Zeile 144). Per Slice-08 Constraints, this is the LAST step before
  //    `Response.json`: `draft.slice(0, 8000)`.
  const capped =
    draft.length > DRAFT_MAX_LENGTH ? draft.slice(0, DRAFT_MAX_LENGTH) : draft;

  return Response.json({ draft: capped }, { status: 200 });
}
