"use server";

import { revalidatePath } from "next/cache";
import { ReferenceService } from "@/lib/services/reference-service";
import { getGenerationReferences, getProject as getProjectQuery } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { referenceImages } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/guard";

import type { ReferenceImage } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UploadReferenceImageInput {
  projectId: string;
  file?: File;
  url?: string;
}

interface DeleteReferenceImageInput {
  id: string;
}

interface AddGalleryAsReferenceInput {
  projectId: string;
  generationId: string;
  imageUrl: string;
}

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

export async function uploadReferenceImage(
  input: UploadReferenceImageInput
): Promise<
  | { id: string; imageUrl: string; width: number; height: number }
  | { error: string }
> {
  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

  // Ownership check: verify project belongs to user
  try {
    await getProjectQuery(input.projectId, auth.userId);
  } catch {
    return { error: "Not found" };
  }

  // AC-3: Validate projectId
  if (!input.projectId || input.projectId.trim().length === 0) {
    return { error: "Ungueltige Projekt-ID" };
  }

  // AC-4: Validate that either file or url is provided
  if (!input.file && !input.url) {
    return { error: "Datei oder URL erforderlich" };
  }

  try {
    // AC-1, AC-2: Delegate to ReferenceService.upload
    const result = await ReferenceService.upload({
      projectId: input.projectId,
      file: input.file,
      url: input.url,
    });

    // AC-6: Revalidate path after successful upload
    revalidatePath("/");

    return result;
  } catch (error: unknown) {
    // AC-5: Pass through error message from service
    return {
      error: error instanceof Error ? error.message : "Unbekannter Fehler",
    };
  }
}

export async function deleteReferenceImage(
  input: DeleteReferenceImageInput
): Promise<{ success: true } | { success: false } | { error: string }> {
  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

  // AC-8: Validate id
  if (!input.id || input.id.trim().length === 0) {
    return { error: "Ungueltige Referenz-ID" };
  }

  try {
    // AC-7: Delegate to ReferenceService.delete
    await ReferenceService.delete(input.id);

    // AC-7: Revalidate path after successful delete
    revalidatePath("/");

    return { success: true };
  } catch {
    // AC-9: Service error returns { success: false }
    return { success: false };
  }
}

export async function addGalleryAsReference(
  input: AddGalleryAsReferenceInput
): Promise<ReferenceImage | { error: string }> {
  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

  // Ownership check: verify project belongs to user
  try {
    await getProjectQuery(input.projectId, auth.userId);
  } catch {
    return { error: "Not found" };
  }

  // AC-6: Validate projectId
  if (!input.projectId || input.projectId.trim().length === 0) {
    return { error: "Ungueltige Projekt-ID" };
  }

  try {
    // AC-5: Delegate to ReferenceService.uploadFromGallery
    const result = await ReferenceService.uploadFromGallery({
      projectId: input.projectId,
      generationId: input.generationId,
      imageUrl: input.imageUrl,
    });

    // AC-8: Revalidate path after successful gallery reference creation
    revalidatePath("/");

    return result;
  } catch (error: unknown) {
    // AC-7: Pass through error message from service
    return {
      error: error instanceof Error ? error.message : "Unbekannter Fehler",
    };
  }
}

// ---------------------------------------------------------------------------
// Reference Count (Slice 16 - used by Lightbox UseAsReference disabled state)
// ---------------------------------------------------------------------------

/**
 * Returns the number of reference images for a project.
 * Used by the Lightbox to determine if the "Als Referenz" button should be disabled (5/5).
 */
export async function getReferenceCount(
  projectId: string
): Promise<number | { error: string }> {
  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

  // Ownership check: verify project belongs to user
  try {
    await getProjectQuery(projectId, auth.userId);
  } catch {
    return { error: "Not found" };
  }

  const rows = await db
    .select({ id: referenceImages.id })
    .from(referenceImages)
    .where(eq(referenceImages.projectId, projectId));
  return rows.length;
}

// ---------------------------------------------------------------------------
// Provenance Data (Slice 15 - used by ProvenanceRow component)
// ---------------------------------------------------------------------------

export interface ProvenanceItem {
  id: string;
  slotPosition: number;
  role: string;
  strength: string;
  imageUrl: string;
  referenceImageId: string;
}

/**
 * Fetches generation references with resolved imageUrls for the ProvenanceRow.
 * Uses existing getGenerationReferences query + individual reference image lookups.
 * Returns [] if no references exist.
 */
export async function getProvenanceData(
  generationId: string
): Promise<ProvenanceItem[] | { error: string }> {
  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const refs = await getGenerationReferences(generationId);

  if (refs.length === 0) {
    return [];
  }

  // Resolve imageUrl for each reference by looking up the reference_images table
  const items: ProvenanceItem[] = [];

  for (const ref of refs) {
    const [refImage] = await db
      .select({ imageUrl: referenceImages.imageUrl })
      .from(referenceImages)
      .where(eq(referenceImages.id, ref.referenceImageId));

    if (refImage) {
      items.push({
        id: ref.id,
        slotPosition: ref.slotPosition,
        role: ref.role,
        strength: ref.strength,
        imageUrl: refImage.imageUrl,
        referenceImageId: ref.referenceImageId,
      });
    }
  }

  return items;
}
