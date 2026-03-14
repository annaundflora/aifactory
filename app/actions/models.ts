"use server";

import { ModelSchemaService } from "@/lib/services/model-schema-service";
import { CollectionModelService } from "@/lib/services/collection-model-service";
import {
  getFavoriteModelIds,
  addFavoriteModel,
  removeFavoriteModel,
  getProjectSelectedModelIds,
  saveProjectSelectedModelIds,
} from "@/lib/db/queries";
import type { CollectionModel } from "@/lib/types/collection-model";

export async function getCollectionModels(): Promise<
  CollectionModel[] | { error: string }
> {
  return CollectionModelService.getCollectionModels();
}

export async function getFavoriteModels(): Promise<string[]> {
  return getFavoriteModelIds();
}

export async function toggleFavoriteModel(input: {
  modelId: string;
}): Promise<{ isFavorite: boolean }> {
  const { modelId } = input;
  const currentFavorites = await getFavoriteModelIds();
  const isFav = currentFavorites.includes(modelId);

  if (isFav) {
    await removeFavoriteModel(modelId);
    return { isFavorite: false };
  } else {
    await addFavoriteModel(modelId);
    return { isFavorite: true };
  }
}

export async function getProjectSelectedModels(input: {
  projectId: string;
}): Promise<string[]> {
  return getProjectSelectedModelIds(input.projectId);
}

export async function saveProjectSelectedModels(input: {
  projectId: string;
  modelIds: string[];
}): Promise<void> {
  await saveProjectSelectedModelIds(input.projectId, input.modelIds);
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
