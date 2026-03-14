/**
 * Backfill script: sets sourceGenerationId for existing img2img generations
 * that have sourceImageUrl but no sourceGenerationId.
 *
 * Matches sourceImageUrl against imageUrl of other generations in the same project.
 *
 * Usage: npx tsx scripts/backfill-source-generation-id.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env manually (no dotenv dependency)
const envPath = resolve(import.meta.dirname ?? __dirname, "../.env");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  const val = trimmed.slice(eqIdx + 1);
  if (!process.env[key]) process.env[key] = val;
}
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and, isNull, isNotNull, sql } from "drizzle-orm";
import * as schema from "../lib/db/schema";

const { generations } = schema;

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return url.replace("postgresql+asyncpg://", "postgresql://");
}

async function main() {
  const connectionString = getDatabaseUrl();
  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  // Step 1: Find all img2img generations with sourceImageUrl but no sourceGenerationId
  const orphans = await db
    .select({
      id: generations.id,
      projectId: generations.projectId,
      sourceImageUrl: generations.sourceImageUrl,
    })
    .from(generations)
    .where(
      and(
        eq(generations.generationMode, "img2img"),
        isNotNull(generations.sourceImageUrl),
        isNull(generations.sourceGenerationId)
      )
    );

  console.log(`Found ${orphans.length} img2img generations without sourceGenerationId`);

  if (orphans.length === 0) {
    console.log("Nothing to backfill.");
    await client.end();
    return;
  }

  let updated = 0;
  let notFound = 0;

  for (const orphan of orphans) {
    if (!orphan.sourceImageUrl) continue;

    // Find the generation whose imageUrl matches this orphan's sourceImageUrl
    // (within the same project for safety)
    const [sourceGen] = await db
      .select({ id: generations.id })
      .from(generations)
      .where(
        and(
          eq(generations.projectId, orphan.projectId),
          eq(generations.imageUrl, orphan.sourceImageUrl)
        )
      )
      .limit(1);

    if (sourceGen) {
      await db
        .update(generations)
        .set({ sourceGenerationId: sourceGen.id })
        .where(eq(generations.id, orphan.id));
      updated++;
      console.log(`  ✓ ${orphan.id} → sourceGenerationId = ${sourceGen.id}`);
    } else {
      notFound++;
      console.log(`  ✗ ${orphan.id} — no matching generation for sourceImageUrl`);
    }
  }

  console.log(`\nDone: ${updated} updated, ${notFound} not matched.`);
  await client.end();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
