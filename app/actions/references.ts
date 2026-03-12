"use server";

import { revalidatePath } from "next/cache";
import { ReferenceService } from "@/lib/services/reference-service";

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

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

export async function uploadReferenceImage(
  input: UploadReferenceImageInput
): Promise<
  | { id: string; imageUrl: string; width: number; height: number }
  | { error: string }
> {
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
  } catch (error: unknown) {
    // AC-9: Service error returns { success: false }
    return { success: false };
  }
}
