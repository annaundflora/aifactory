import { useMemo } from 'react';
import type { Model } from '@/lib/services/model-catalog-service';

export type SortOption = 'popular' | 'newest';

/**
 * Custom hook for client-side filtering and sorting of Model arrays.
 *
 * - Search: case-insensitive match against name and description (null-safe)
 * - Owner filter: single-select; null or '' disables the filter
 * - Both filters are combined with AND logic
 * - owners: unique list in first-occurrence order (no duplicates)
 * - sortBy: "popular" sorts by runCount desc, "newest" sorts by createdAt desc
 * - Stateless: accepts searchQuery, ownerFilter, and sortBy as parameters
 * - Uses useMemo to avoid recomputation on unrelated renders
 */
export function useModelFilters(
  models: Model[],
  searchQuery: string,
  ownerFilter: string | null,
  sortBy: SortOption = 'newest',
): { filteredModels: Model[]; owners: string[] } {
  const owners = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const model of models) {
      if (!seen.has(model.owner)) {
        seen.add(model.owner);
        result.push(model.owner);
      }
    }
    return result;
  }, [models]);

  const filteredModels = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const hasSearch = query.length > 0;
    const hasOwner = ownerFilter !== null && ownerFilter !== '';

    let result: Model[];

    if (!hasSearch && !hasOwner) {
      result = [...models];
    } else {
      result = models.filter((model) => {
        if (hasOwner && model.owner !== ownerFilter) {
          return false;
        }
        if (hasSearch) {
          const nameMatch = model.name.toLowerCase().includes(query);
          const descMatch =
            model.description !== null &&
            model.description.toLowerCase().includes(query);
          if (!nameMatch && !descMatch) {
            return false;
          }
        }
        return true;
      });
    }

    if (sortBy === 'newest') {
      result.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
    } else {
      result.sort((a, b) => (b.runCount ?? 0) - (a.runCount ?? 0));
    }

    return result;
  }, [models, searchQuery, ownerFilter, sortBy]);

  return { filteredModels, owners };
}
