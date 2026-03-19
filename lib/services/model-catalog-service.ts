import {
  getActiveModels,
  getModelsByCapability,
  getModelByReplicateId,
  getModelSchema,
  type Model,
} from "@/lib/db/queries";

export type { Model };

/**
 * ModelCatalogService — Read-only service for model data from the `models` table.
 *
 * Delegates all queries to standalone query functions in `lib/db/queries.ts`.
 * All reads filter on `is_active = true`.
 */
export const ModelCatalogService = {
  /**
   * Returns all active models.
   */
  async getAll(): Promise<Model[]> {
    return getActiveModels();
  },

  /**
   * Returns active models that have the given capability set to true.
   * Capability is matched via JSONB `capabilities->>'capability' = 'true'`.
   */
  async getByCapability(capability: string): Promise<Model[]> {
    return getModelsByCapability(capability);
  },

  /**
   * Returns a single active model by its replicate_id (owner/name format),
   * or null if not found or inactive.
   */
  async getByReplicateId(replicateId: string): Promise<Model | null> {
    return getModelByReplicateId(replicateId);
  },

  /**
   * Returns the input_schema JSONB for the model with the given replicate_id,
   * or null if the model is not found, is inactive, or has no schema.
   */
  async getSchema(replicateId: string): Promise<unknown | null> {
    return getModelSchema(replicateId);
  },
};
