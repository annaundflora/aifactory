import { describe, it, expect } from 'vitest'
import { makeGeneration, makeEntry } from './factories'

describe('makeGeneration factory', () => {
  /**
   * AC-1: GIVEN die neue Datei `lib/__tests__/factories.ts`
   *       WHEN `makeGeneration()` ohne Argumente aufgerufen wird
   *       THEN gibt die Funktion ein Objekt vom Typ `Generation` zurueck
   *       AND das Objekt enthaelt KEINE Properties `promptStyle` oder `negativePrompt`
   */
  it('AC-1: should return a Generation object without promptStyle or negativePrompt', () => {
    const gen = makeGeneration()

    // Must NOT contain removed properties
    expect(gen).not.toHaveProperty('promptStyle')
    expect(gen).not.toHaveProperty('negativePrompt')

    // Verify it is a plain object (not null, not array)
    expect(typeof gen).toBe('object')
    expect(gen).not.toBeNull()
    expect(Array.isArray(gen)).toBe(false)
  })

  /**
   * AC-1: GIVEN die neue Datei `lib/__tests__/factories.ts`
   *       WHEN `makeGeneration()` ohne Argumente aufgerufen wird
   *       THEN das Objekt enthaelt die Properties `prompt`, `promptMotiv`, `id`, `projectId`, `modelId`, `status`
   *       (alle mit sinnvollen Defaults)
   */
  it('AC-1: should include prompt, promptMotiv, id, projectId, modelId, status as defaults', () => {
    const gen = makeGeneration()

    // All required properties must exist with sensible defaults
    expect(gen).toHaveProperty('id')
    expect(gen).toHaveProperty('projectId')
    expect(gen).toHaveProperty('prompt')
    expect(gen).toHaveProperty('promptMotiv')
    expect(gen).toHaveProperty('modelId')
    expect(gen).toHaveProperty('status')

    // Defaults must be non-empty strings (sensible defaults)
    expect(typeof gen.id).toBe('string')
    expect(gen.id.length).toBeGreaterThan(0)

    expect(typeof gen.projectId).toBe('string')
    expect(gen.projectId.length).toBeGreaterThan(0)

    expect(typeof gen.prompt).toBe('string')
    expect(gen.prompt.length).toBeGreaterThan(0)

    expect(typeof gen.promptMotiv).toBe('string')

    expect(typeof gen.modelId).toBe('string')
    expect(gen.modelId.length).toBeGreaterThan(0)

    expect(typeof gen.status).toBe('string')
    expect(gen.status.length).toBeGreaterThan(0)
  })

  /**
   * AC-2: GIVEN die `makeGeneration`-Factory aus AC-1
   *       WHEN `makeGeneration({ id: "custom-id", prompt: "A red fox" })` aufgerufen wird
   *       THEN enthaelt das zurueckgegebene Objekt `id: "custom-id"` und `prompt: "A red fox"`
   */
  it('AC-2: should allow overriding specific properties via partial object', () => {
    const gen = makeGeneration({ id: 'custom-id', prompt: 'A red fox' })

    expect(gen.id).toBe('custom-id')
    expect(gen.prompt).toBe('A red fox')
  })

  /**
   * AC-2: GIVEN die `makeGeneration`-Factory aus AC-1
   *       WHEN `makeGeneration({ id: "custom-id", prompt: "A red fox" })` aufgerufen wird
   *       THEN alle nicht uebergebenen Properties haben Default-Werte
   */
  it('AC-2: should keep default values for non-overridden properties', () => {
    const defaults = makeGeneration()
    const overridden = makeGeneration({ id: 'custom-id', prompt: 'A red fox' })

    // Overridden values must differ from defaults
    expect(overridden.id).toBe('custom-id')
    expect(overridden.prompt).toBe('A red fox')

    // Non-overridden values must match defaults exactly
    expect(overridden.projectId).toBe(defaults.projectId)
    expect(overridden.promptMotiv).toBe(defaults.promptMotiv)
    expect(overridden.modelId).toBe(defaults.modelId)
    expect(overridden.status).toBe(defaults.status)
    expect(overridden.modelParams).toEqual(defaults.modelParams)
    expect(overridden.imageUrl).toBe(defaults.imageUrl)
    expect(overridden.isFavorite).toBe(defaults.isFavorite)
    expect(overridden.createdAt).toEqual(defaults.createdAt)
    expect(overridden.generationMode).toBe(defaults.generationMode)

    // Removed properties must still not exist
    expect(overridden).not.toHaveProperty('promptStyle')
    expect(overridden).not.toHaveProperty('negativePrompt')
  })
})

describe('makeEntry factory', () => {
  /**
   * AC-3: GIVEN die neue Datei `lib/__tests__/factories.ts`
   *       WHEN `makeEntry()` ohne Argumente aufgerufen wird
   *       THEN gibt die Funktion ein Objekt vom Typ `PromptHistoryEntry` zurueck
   *       AND das Objekt enthaelt KEINE Properties `promptStyle` oder `negativePrompt`
   */
  it('AC-3: should return a PromptHistoryEntry without promptStyle or negativePrompt', () => {
    const entry = makeEntry()

    // Must NOT contain removed properties
    expect(entry).not.toHaveProperty('promptStyle')
    expect(entry).not.toHaveProperty('negativePrompt')

    // Verify it is a plain object
    expect(typeof entry).toBe('object')
    expect(entry).not.toBeNull()
    expect(Array.isArray(entry)).toBe(false)
  })

  /**
   * AC-3: GIVEN die neue Datei `lib/__tests__/factories.ts`
   *       WHEN `makeEntry()` ohne Argumente aufgerufen wird
   *       THEN das Objekt enthaelt die Properties `generationId`, `promptMotiv`, `modelId`, `modelParams`, `isFavorite`, `createdAt`
   */
  it('AC-3: should include generationId, promptMotiv, modelId, modelParams, isFavorite, createdAt', () => {
    const entry = makeEntry()

    // All required PromptHistoryEntry properties
    expect(entry).toHaveProperty('generationId')
    expect(entry).toHaveProperty('promptMotiv')
    expect(entry).toHaveProperty('modelId')
    expect(entry).toHaveProperty('modelParams')
    expect(entry).toHaveProperty('isFavorite')
    expect(entry).toHaveProperty('createdAt')

    // Type checks for sensible defaults
    expect(typeof entry.generationId).toBe('string')
    expect(entry.generationId.length).toBeGreaterThan(0)

    expect(typeof entry.promptMotiv).toBe('string')

    expect(typeof entry.modelId).toBe('string')
    expect(entry.modelId.length).toBeGreaterThan(0)

    expect(typeof entry.modelParams).toBe('object')
    expect(entry.modelParams).not.toBeNull()

    expect(typeof entry.isFavorite).toBe('boolean')

    expect(entry.createdAt).toBeInstanceOf(Date)
  })

  /**
   * AC-4: GIVEN die `makeEntry`-Factory aus AC-3
   *       WHEN `makeEntry({ promptMotiv: "Sunset", isFavorite: true })` aufgerufen wird
   *       THEN enthaelt das zurueckgegebene Objekt `promptMotiv: "Sunset"` und `isFavorite: true`
   */
  it('AC-4: should allow overriding promptMotiv and isFavorite', () => {
    const entry = makeEntry({ promptMotiv: 'Sunset', isFavorite: true })

    expect(entry.promptMotiv).toBe('Sunset')
    expect(entry.isFavorite).toBe(true)
  })

  /**
   * AC-4: GIVEN die `makeEntry`-Factory aus AC-3
   *       WHEN `makeEntry({ promptMotiv: "Sunset", isFavorite: true })` aufgerufen wird
   *       THEN alle nicht uebergebenen Properties haben Default-Werte
   */
  it('AC-4: should keep default values for non-overridden properties', () => {
    const defaults = makeEntry()
    const overridden = makeEntry({ promptMotiv: 'Sunset', isFavorite: true })

    // Overridden values
    expect(overridden.promptMotiv).toBe('Sunset')
    expect(overridden.isFavorite).toBe(true)

    // Non-overridden values must match defaults exactly
    expect(overridden.generationId).toBe(defaults.generationId)
    expect(overridden.modelId).toBe(defaults.modelId)
    expect(overridden.modelParams).toEqual(defaults.modelParams)
    expect(overridden.createdAt).toEqual(defaults.createdAt)

    // Removed properties must still not exist
    expect(overridden).not.toHaveProperty('promptStyle')
    expect(overridden).not.toHaveProperty('negativePrompt')
  })
})
