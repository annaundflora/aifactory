// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useModelFilters } from '../use-model-filters';
import type { CollectionModel } from '@/lib/types/collection-model';

/** Helper to create a CollectionModel with sensible defaults. */
function makeModel(
  overrides: Partial<CollectionModel> & Pick<CollectionModel, 'owner' | 'name'>,
): CollectionModel {
  return {
    url: `https://replicate.com/${overrides.owner}/${overrides.name}`,
    description: null,
    cover_image_url: null,
    run_count: 0,
    ...overrides,
  };
}

// ── Test data ──────────────────────────────────────────────────────────────

const FLUX_PRO = makeModel({
  owner: 'black-forest-labs',
  name: 'flux-pro',
  description: 'State-of-the-art image generation with pro quality',
});

const FLUX_SCHNELL = makeModel({
  owner: 'black-forest-labs',
  name: 'flux-schnell',
  description: 'Fast image generation model',
});

const SDXL = makeModel({
  owner: 'stability-ai',
  name: 'sdxl',
  description: 'Stable Diffusion XL base model',
});

const AURA_FLOW = makeModel({
  owner: 'fal-ai',
  name: 'aura-flow',
  description: null, // intentionally null for AC-3
});

const THREE_MODELS = [FLUX_PRO, SDXL, AURA_FLOW];

const FOUR_MODELS_WITH_DUP_OWNER = [FLUX_PRO, SDXL, FLUX_SCHNELL, AURA_FLOW];

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useModelFilters', () => {
  // AC-1: Suche nach Name/Description (lowercase match)
  it('AC-1: GIVEN 3 CollectionModel objects WHEN searchQuery is "flux" THEN filteredModels contains only models whose name or description contains "flux" (case-insensitive)', () => {
    const { result } = renderHook(() =>
      useModelFilters(THREE_MODELS, 'flux', null),
    );

    expect(result.current.filteredModels).toHaveLength(1);
    expect(result.current.filteredModels[0].name).toBe('flux-pro');
  });

  // AC-2: Suche case-insensitive (uppercase query)
  it('AC-2: GIVEN 3 CollectionModel objects WHEN searchQuery is "FLUX" THEN filteredModels returns the same results as lowercase "flux"', () => {
    const { result: lower } = renderHook(() =>
      useModelFilters(THREE_MODELS, 'flux', null),
    );
    const { result: upper } = renderHook(() =>
      useModelFilters(THREE_MODELS, 'FLUX', null),
    );

    expect(upper.current.filteredModels).toEqual(lower.current.filteredModels);
    expect(upper.current.filteredModels).toHaveLength(1);
    expect(upper.current.filteredModels[0].name).toBe('flux-pro');
  });

  // AC-3: null-Description -- kein Fehler, kein Match
  it('AC-3: GIVEN a model with description: null WHEN searchQuery matches another model description THEN the null-description model is excluded AND no error is thrown', () => {
    // "Stable" only appears in SDXL's description
    const { result } = renderHook(() =>
      useModelFilters(THREE_MODELS, 'Stable', null),
    );

    expect(result.current.filteredModels).toHaveLength(1);
    expect(result.current.filteredModels[0].name).toBe('sdxl');
    // AURA_FLOW (description: null) must not appear
    expect(
      result.current.filteredModels.find((m) => m.name === 'aura-flow'),
    ).toBeUndefined();
  });

  // AC-4: Owner-Filter -- nur Modelle des gesetzten Owners
  it('AC-4: GIVEN models with various owners WHEN ownerFilter is "stability-ai" THEN filteredModels contains only models with owner "stability-ai"', () => {
    const { result } = renderHook(() =>
      useModelFilters(THREE_MODELS, '', 'stability-ai'),
    );

    expect(result.current.filteredModels).toHaveLength(1);
    expect(result.current.filteredModels[0].owner).toBe('stability-ai');
  });

  // AC-5: Kein Owner-Filter -- alle Modelle
  it('AC-5: GIVEN models WHEN ownerFilter is null or empty string THEN all models are returned', () => {
    const { result: withNull } = renderHook(() =>
      useModelFilters(THREE_MODELS, '', null),
    );
    const { result: withEmpty } = renderHook(() =>
      useModelFilters(THREE_MODELS, '', ''),
    );

    expect(withNull.current.filteredModels).toHaveLength(3);
    expect(withEmpty.current.filteredModels).toHaveLength(3);
    expect(withNull.current.filteredModels).toEqual(
      withEmpty.current.filteredModels,
    );
  });

  // AC-6: AND-Logik fuer kombinierte Filter
  it('AC-6: GIVEN searchQuery "pro" and ownerFilter "black-forest-labs" WHEN filteredModels is evaluated THEN only models matching BOTH conditions are returned', () => {
    const models = [FLUX_PRO, FLUX_SCHNELL, SDXL, AURA_FLOW];
    const { result } = renderHook(() =>
      useModelFilters(models, 'pro', 'black-forest-labs'),
    );

    // Only FLUX_PRO matches both: owner=black-forest-labs AND name/description contains "pro"
    expect(result.current.filteredModels).toHaveLength(1);
    expect(result.current.filteredModels[0].name).toBe('flux-pro');
    expect(result.current.filteredModels[0].owner).toBe('black-forest-labs');
  });

  // AC-7: Unique Owner-Liste ohne Duplikate
  it('AC-7: GIVEN models with owners ["black-forest-labs","stability-ai","black-forest-labs","fal-ai"] WHEN owners is read THEN it returns 3 unique entries in first-occurrence order', () => {
    const { result } = renderHook(() =>
      useModelFilters(FOUR_MODELS_WITH_DUP_OWNER, '', null),
    );

    expect(result.current.owners).toEqual([
      'black-forest-labs',
      'stability-ai',
      'fal-ai',
    ]);
    expect(result.current.owners).toHaveLength(3);
  });

  // AC-8: Leeres Array -- kein Fehler
  it('AC-8: GIVEN an empty CollectionModel array WHEN the hook is initialized THEN filteredModels is empty AND owners is empty', () => {
    const { result } = renderHook(() => useModelFilters([], '', null));

    expect(result.current.filteredModels).toEqual([]);
    expect(result.current.owners).toEqual([]);
  });

  // AC-9: Keine Filter aktiv -- alle Modelle ungefiltert
  it('AC-9: GIVEN models WHEN searchQuery is empty and ownerFilter is not set THEN filteredModels returns all models unfiltered', () => {
    const { result } = renderHook(() =>
      useModelFilters(THREE_MODELS, '', null),
    );

    expect(result.current.filteredModels).toEqual(THREE_MODELS);
    expect(result.current.filteredModels).toHaveLength(3);
  });
});
