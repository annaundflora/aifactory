import { useState, useEffect, useRef } from "react";
import { getModelSchema } from "@/app/actions/models";

export interface UseModelSchemaResult {
  schema: Record<string, unknown> | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * React hook to fetch a model's input schema via the `getModelSchema` server action.
 *
 * - Returns `{ schema: null, isLoading: false, error: null }` when `modelId` is undefined.
 * - Fetches the schema when `modelId` changes and manages loading/error states.
 * - Ignores stale responses when `modelId` changes before a fetch completes.
 * - On error, returns `{ schema: null, isLoading: false, error: "..." }` (no throw).
 */
export function useModelSchema(
  modelId: string | undefined,
): UseModelSchemaResult {
  const [schema, setSchema] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the latest modelId to ignore stale responses
  const latestModelIdRef = useRef(modelId);

  useEffect(() => {
    latestModelIdRef.current = modelId;

    // No modelId -> reset to idle state
    if (!modelId) {
      setSchema(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function fetchSchema(id: string) {
      setIsLoading(true);
      setError(null);
      setSchema(null);

      try {
        const result = await getModelSchema({ modelId: id });

        // Ignore if modelId changed while we were fetching
        if (cancelled || latestModelIdRef.current !== id) {
          return;
        }

        if ("error" in result) {
          setError(result.error);
          setSchema(null);
        } else {
          setSchema(result.properties);
          setError(null);
        }
      } catch (err) {
        // Ignore if modelId changed while we were fetching
        if (cancelled || latestModelIdRef.current !== id) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Schema konnte nicht geladen werden",
        );
        setSchema(null);
      } finally {
        if (!cancelled && latestModelIdRef.current === modelId) {
          setIsLoading(false);
        }
      }
    }

    fetchSchema(modelId);

    return () => {
      cancelled = true;
    };
  }, [modelId]);

  return { schema, isLoading, error };
}
