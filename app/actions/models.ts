"use server";

import { ModelSchemaService } from "@/lib/services/model-schema-service";
import { CollectionModelService } from "@/lib/services/collection-model-service";
import type { CollectionModel } from "@/lib/types/collection-model";

export async function getCollectionModels(): Promise<
  CollectionModel[] | { error: string }
> {
  return CollectionModelService.getCollectionModels();
}

export async function checkImg2ImgSupport(input: {
  modelId: string;
}): Promise<boolean> {
  const { modelId } = input;
  if (!modelId || !modelId.includes("/")) return false;
  try {
    return await ModelSchemaService.supportsImg2Img(modelId);
  } catch {
    return false;
  }
}

export async function getModelSchema(input: {
  modelId: string;
}): Promise<{ properties: Record<string, unknown> } | { error: string }> {
  const { modelId } = input;

  if (!modelId || !modelId.includes("/")) {
    return { error: "Unbekanntes Modell" };
  }

  try {
    const properties = await ModelSchemaService.getSchema(modelId);
    return { properties };
  } catch {
    return { error: "Schema konnte nicht geladen werden" };
  }
}
