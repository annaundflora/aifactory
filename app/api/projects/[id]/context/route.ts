/**
 * GET / PATCH /api/projects/{id}/context
 *
 * HTTP boundary for per-project assistant context. Wraps the Drizzle query
 * helpers (`getProjectContext`, `updateProjectContext`) with `requireAuth()`,
 * inline DTO validation (no Zod — repo convention) and status-code mapping
 * 401 / 200 / 404 / 422.
 *
 * Auth: Auth.js session cookie via `requireAuth()`.
 * Ownership: enforced inline by the combined `id + userId` filter inside the
 *            query helpers — a 404 is returned both for "project does not
 *            exist" and "project not owned" (no existence leak).
 * Runtime: nodejs (postgres-js needs TCP sockets, no Edge).
 */

import { requireAuth } from "@/lib/auth/guard";
import {
  getProjectContext,
  updateProjectContext,
} from "@/lib/db/queries";

// Force Node.js runtime — postgres-js uses TCP sockets which are not
// available in Edge runtime, causing AdapterError on every DB query.
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CONTEXT_LENGTH = 8000;

// Wortlaut exakt aus architecture.md → Section "DTO Validation Rules"
// (Zeile 337) — für i18n-Konsistenz mit Frontend-Toasts.
const ERROR_LENGTH_EXCEEDED = `Context exceeds maximum length of ${MAX_CONTEXT_LENGTH} characters.`;
const ERROR_INVALID_BODY = "Invalid request body";
const ERROR_NOT_FOUND = "Project not found";
const ERROR_UNAUTHORIZED = "Unauthorized";

// ---------------------------------------------------------------------------
// Body validation (no Zod — inline type guards, matching repo convention)
// ---------------------------------------------------------------------------

type UpdateBody = { context_instructions: string | null };

function isUpdateBody(value: unknown): value is UpdateBody {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("context_instructions" in value)) {
    return false;
  }
  const ci = (value as { context_instructions: unknown }).context_instructions;
  return typeof ci === "string" || ci === null;
}

// ---------------------------------------------------------------------------
// Response shape (snake_case per architecture.md DTO Schemas, Zeile 142)
// ---------------------------------------------------------------------------

type ProjectContextResponse = {
  id: string;
  context_instructions: string | null;
  context_updated_at: string | null;
};

function buildResponse(
  id: string,
  row: { contextInstructions: string | null; contextUpdatedAt: Date | null },
): ProjectContextResponse {
  return {
    id,
    context_instructions: row.contextInstructions,
    context_updated_at: row.contextUpdatedAt
      ? row.contextUpdatedAt.toISOString()
      : null,
  };
}

// ---------------------------------------------------------------------------
// GET /api/projects/{id}/context
// ---------------------------------------------------------------------------

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Auth
  const authResult = await requireAuth();
  if ("error" in authResult) {
    return Response.json({ error: ERROR_UNAUTHORIZED }, { status: 401 });
  }

  // 2. Resolve dynamic segment
  const { id } = await params;

  // 3. Query (ownership enforced via combined id + userId filter)
  const row = await getProjectContext({
    projectId: id,
    userId: authResult.userId,
  });

  if (row === null) {
    return Response.json({ error: ERROR_NOT_FOUND }, { status: 404 });
  }

  return Response.json(buildResponse(id, row), { status: 200 });
}

// ---------------------------------------------------------------------------
// PATCH /api/projects/{id}/context
// ---------------------------------------------------------------------------

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Auth
  const authResult = await requireAuth();
  if ("error" in authResult) {
    return Response.json({ error: ERROR_UNAUTHORIZED }, { status: 401 });
  }

  // 2. Parse + validate body (no DB call before validation)
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return Response.json({ error: ERROR_INVALID_BODY }, { status: 422 });
  }

  if (!isUpdateBody(parsed)) {
    return Response.json({ error: ERROR_INVALID_BODY }, { status: 422 });
  }

  // 3. Trim + length-check (architecture.md → "Input Validation", Zeile 383)
  //    null durchreichen (Clear-Pfad); Strings trimmen, dann length-check
  //    auf post-trim Länge.
  let contextInstructions: string | null;
  if (parsed.context_instructions === null) {
    contextInstructions = null;
  } else {
    const trimmed = parsed.context_instructions.trim();
    if (trimmed.length > MAX_CONTEXT_LENGTH) {
      return Response.json(
        { error: ERROR_LENGTH_EXCEEDED },
        { status: 422 },
      );
    }
    contextInstructions = trimmed;
  }

  // 4. Resolve dynamic segment + persist (ownership enforced via combined filter)
  const { id } = await params;

  const row = await updateProjectContext({
    projectId: id,
    userId: authResult.userId,
    contextInstructions,
  });

  if (row === null) {
    return Response.json({ error: ERROR_NOT_FOUND }, { status: 404 });
  }

  return Response.json(buildResponse(id, row), { status: 200 });
}
