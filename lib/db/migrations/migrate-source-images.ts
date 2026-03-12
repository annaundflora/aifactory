import { isNotNull } from "drizzle-orm";
import { db } from "../index";
import { generations } from "../schema";
import {
  createReferenceImage,
  createGenerationReferences,
  getGenerationReferences,
} from "../queries";

export interface MigrationSummary {
  migrated: number;
  skipped: number;
  errors: number;
}

const BATCH_SIZE = 50;

/**
 * Migrates all existing generations with sourceImageUrl to the new
 * reference_images + generation_references system.
 *
 * For each generation with a non-null sourceImageUrl:
 * - Creates a reference_images record (sourceType="gallery", sourceGenerationId=generation.id)
 * - Creates a generation_references record (role="content", strength="moderate", slotPosition=1)
 *
 * Idempotent: skips generations that already have generation_references records.
 * Processes in batches to avoid excessive single-INSERT overhead.
 */
export async function migrateSourceImages(): Promise<MigrationSummary> {
  const summary: MigrationSummary = { migrated: 0, skipped: 0, errors: 0 };

  // Fetch all generations that have a sourceImageUrl set
  const generationsWithSource = await db
    .select({
      id: generations.id,
      projectId: generations.projectId,
      sourceImageUrl: generations.sourceImageUrl,
    })
    .from(generations)
    .where(isNotNull(generations.sourceImageUrl));

  // Process in batches
  for (let i = 0; i < generationsWithSource.length; i += BATCH_SIZE) {
    const batch = generationsWithSource.slice(i, i + BATCH_SIZE);

    // Collect items to migrate in this batch (after idempotency check)
    const toMigrate: {
      generationId: string;
      projectId: string;
      sourceImageUrl: string;
    }[] = [];

    for (const gen of batch) {
      try {
        // Idempotency check: skip if generation already has references
        const existingRefs = await getGenerationReferences(gen.id);
        if (existingRefs.length > 0) {
          summary.skipped++;
          continue;
        }

        toMigrate.push({
          generationId: gen.id,
          projectId: gen.projectId,
          sourceImageUrl: gen.sourceImageUrl!,
        });
      } catch (error) {
        console.error(
          `Error checking generation ${gen.id}:`,
          error
        );
        summary.errors++;
      }
    }

    // Process migrations for this batch
    for (const item of toMigrate) {
      try {
        // Create the reference_images record
        const refImage = await createReferenceImage({
          projectId: item.projectId,
          imageUrl: item.sourceImageUrl,
          sourceType: "gallery",
          sourceGenerationId: item.generationId,
        });

        // Create the generation_references record in a batch insert
        await createGenerationReferences([
          {
            generationId: item.generationId,
            referenceImageId: refImage.id,
            role: "content",
            strength: "moderate",
            slotPosition: 1,
          },
        ]);

        summary.migrated++;
      } catch (error) {
        console.error(
          `Error migrating generation ${item.generationId}:`,
          error
        );
        summary.errors++;
      }
    }
  }

  console.log(
    `Migrated: ${summary.migrated} generations, Skipped: ${summary.skipped} (already migrated), Errors: ${summary.errors}`
  );

  return summary;
}

// Allow direct execution via: npx tsx lib/db/migrations/migrate-source-images.ts
const isDirectExecution =
  typeof require !== "undefined" && require.main === module;

if (isDirectExecution) {
  migrateSourceImages()
    .then((result) => {
      console.log("Migration complete:", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
