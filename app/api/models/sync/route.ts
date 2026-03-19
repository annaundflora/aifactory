/**
 * POST /api/models/sync — Streaming sync endpoint.
 *
 * Returns a ReadableStream of newline-delimited JSON events:
 *   - { type: "progress", completed, total }
 *   - { type: "complete", synced, failed, new, updated }
 *   - { type: "error", message }
 *
 * Auth: session cookie via auth().
 * Concurrency: module-scoped lock prevents parallel syncs.
 * Runtime: nodejs (postgres-js needs TCP sockets, no Edge).
 */

import { auth } from "@/auth";
import { ModelSyncService } from "@/lib/services/model-sync-service";

// Force Node.js runtime — postgres-js uses TCP sockets which are not
// available in Edge runtime, causing AdapterError on every DB query.
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Module-scoped sync lock (only one sync at a time)
// ---------------------------------------------------------------------------

let isSyncing = false;

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST() {
  // Auth check
  const session = await auth();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Create the ReadableStream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Check sync lock
      if (isSyncing) {
        controller.enqueue(
          encoder.encode(
            JSON.stringify({ type: "error", message: "Sync bereits aktiv" }) +
              "\n"
          )
        );
        controller.close();
        return;
      }

      // Acquire lock
      isSyncing = true;

      try {
        const result = await ModelSyncService.syncAll((completed, total) => {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ type: "progress", completed, total }) + "\n"
            )
          );
        });

        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: "complete",
              synced: result.synced,
              failed: result.failed,
              new: result.new,
              updated: result.updated,
            }) + "\n"
          )
        );
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Unknown sync error";
        controller.enqueue(
          encoder.encode(
            JSON.stringify({ type: "error", message }) + "\n"
          )
        );
      } finally {
        isSyncing = false;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
