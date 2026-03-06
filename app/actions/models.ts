"use server";

import { getModelById } from "@/lib/models";
import { ModelSchemaService } from "@/lib/services/model-schema-service";

export async function getModelSchema(input: {
  modelId: string;
}): Promise<{ properties: Record<string, unknown> } | { error: string }> {
  const { modelId } = input;

  if (!modelId || !getModelById(modelId)) {
    return { error: "Unbekanntes Modell" };
  }

  try {
    const properties = await ModelSchemaService.getSchema(modelId);
    return { properties };
  } catch {
    return { error: "Schema konnte nicht geladen werden" };
  }
}
