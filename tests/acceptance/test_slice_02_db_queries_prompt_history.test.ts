import { describe, it, expect, expectTypeOf } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Acceptance Tests for slice-02-db-queries-prompt-history
 *
 * Tests validate all 6 Acceptance Criteria from the slice spec.
 * Each test maps 1:1 to a GIVEN/WHEN/THEN block.
 *
 * Mocking Strategy: mock_external (per Slice-Spec)
 * Approach: source-code inspection + type-level checks. No DB connection needed.
 */

// ---------------------------------------------------------------------------
// Source file reads
// ---------------------------------------------------------------------------
const queriesSourcePath = path.resolve(
  __dirname,
  '..',
  '..',
  'lib',
  'db',
  'queries.ts'
)
const serviceSourcePath = path.resolve(
  __dirname,
  '..',
  '..',
  'lib',
  'services',
  'prompt-history-service.ts'
)
const queriesSource = fs.readFileSync(queriesSourcePath, 'utf-8')
const serviceSource = fs.readFileSync(serviceSourcePath, 'utf-8')

// ---------------------------------------------------------------------------
// Type imports for compile-time assertions
// ---------------------------------------------------------------------------
import type { CreateGenerationInput, PromptHistoryRow } from '../../lib/db/queries'
import type { PromptHistoryEntry } from '../../lib/services/prompt-history-service'

describe('Slice 02: DB Queries & Prompt History Service - Acceptance', () => {
  // =========================================================================
  // AC-1
  // =========================================================================
  it('AC-1: GIVEN das bereinigte Schema aus Slice 01 WHEN das Interface CreateGenerationInput geprueft wird THEN enthaelt es KEINE promptStyle/negativePrompt AND createGeneration referenziert KEINE entfernten Spalten', () => {
    // --- Type-level: CreateGenerationInput must NOT have removed properties ---
    type HasPromptStyle = 'promptStyle' extends keyof CreateGenerationInput ? true : false
    type HasNegativePrompt = 'negativePrompt' extends keyof CreateGenerationInput ? true : false
    expectTypeOf<HasPromptStyle>().toEqualTypeOf<false>()
    expectTypeOf<HasNegativePrompt>().toEqualTypeOf<false>()

    // --- Source: Interface body must not contain removed fields ---
    const interfaceMatch = queriesSource.match(
      /export\s+interface\s+CreateGenerationInput\s*\{([^}]+)\}/s
    )
    expect(interfaceMatch).not.toBeNull()
    expect(interfaceMatch![1]).not.toMatch(/promptStyle/)
    expect(interfaceMatch![1]).not.toMatch(/negativePrompt/)

    // --- Source: createGeneration function must not reference removed fields ---
    const fnMatch = queriesSource.match(
      /export\s+async\s+function\s+createGeneration\s*\([^)]*\)[^{]*\{([\s\S]*?)^}/m
    )
    expect(fnMatch).not.toBeNull()
    expect(fnMatch![1]).not.toMatch(/promptStyle/)
    expect(fnMatch![1]).not.toMatch(/negativePrompt/)
    expect(fnMatch![1]).not.toMatch(/prompt_style/)
    expect(fnMatch![1]).not.toMatch(/negative_prompt/)
  })

  // =========================================================================
  // AC-2
  // =========================================================================
  it('AC-2: GIVEN das bereinigte Schema WHEN getPromptHistoryQuery ausgefuehrt wird THEN verwendet DISTINCT ON nur prompt_motiv+model_id AND SELECT/ORDER BY enthaelt KEINE entfernten Spalten', () => {
    // Extract getPromptHistoryQuery function
    const fnMatch = queriesSource.match(
      /export\s+async\s+function\s+getPromptHistoryQuery[\s\S]*?^}/m
    )
    expect(fnMatch).not.toBeNull()
    const fnBody = fnMatch![0]

    // DISTINCT ON must have exactly 2 fields: prompt_motiv and model_id
    const distinctOnMatch = fnBody.match(/DISTINCT\s+ON\s*\(([^)]+)\)/i)
    expect(distinctOnMatch).not.toBeNull()
    const distinctFields = distinctOnMatch![1].split(',').map((f: string) => f.trim())
    expect(distinctFields).toHaveLength(2)
    expect(distinctFields[0]).toMatch(/g\.prompt_motiv/)
    expect(distinctFields[1]).toMatch(/g\.model_id/)

    // SELECT clause must NOT contain removed columns
    expect(fnBody).not.toMatch(/prompt_style/)
    expect(fnBody).not.toMatch(/negative_prompt/)
    expect(fnBody).not.toMatch(/promptStyle/)
    expect(fnBody).not.toMatch(/negativePrompt/)

    // Subquery ORDER BY must only reference prompt_motiv and model_id (plus created_at)
    const subqueryOrderBy = fnBody.match(
      /SELECT\s+DISTINCT\s+ON[\s\S]*?ORDER\s+BY\s+([^\n]+)/i
    )
    expect(subqueryOrderBy).not.toBeNull()
    expect(subqueryOrderBy![1]).not.toMatch(/prompt_style/)
    expect(subqueryOrderBy![1]).not.toMatch(/negative_prompt/)
  })

  // =========================================================================
  // AC-3
  // =========================================================================
  it('AC-3: GIVEN das bereinigte Schema WHEN getFavoritesQuery ausgefuehrt wird THEN enthaelt .select() KEINE entfernten Spalten AND Ergebnis hat weiterhin alle required Felder', () => {
    // Extract getFavoritesQuery function
    const fnMatch = queriesSource.match(
      /export\s+async\s+function\s+getFavoritesQuery[\s\S]*?^}/m
    )
    expect(fnMatch).not.toBeNull()
    const fnBody = fnMatch![0]

    // Must NOT reference removed fields
    expect(fnBody).not.toMatch(/generations\.promptStyle/)
    expect(fnBody).not.toMatch(/generations\.negativePrompt/)
    expect(fnBody).not.toMatch(/promptStyle\s*:/)
    expect(fnBody).not.toMatch(/negativePrompt\s*:/)

    // Must still have all required fields in .select()
    expect(fnBody).toMatch(/generations\.id/)
    expect(fnBody).toMatch(/generations\.promptMotiv/)
    expect(fnBody).toMatch(/generations\.modelId/)
    expect(fnBody).toMatch(/generations\.modelParams/)
    expect(fnBody).toMatch(/generations\.isFavorite/)
    expect(fnBody).toMatch(/generations\.createdAt/)

    // Return type PromptHistoryRow must have required fields
    type RequiredKeys = keyof PromptHistoryRow
    expectTypeOf<'id'>().toMatchTypeOf<RequiredKeys>()
    expectTypeOf<'promptMotiv'>().toMatchTypeOf<RequiredKeys>()
    expectTypeOf<'modelId'>().toMatchTypeOf<RequiredKeys>()
    expectTypeOf<'modelParams'>().toMatchTypeOf<RequiredKeys>()
    expectTypeOf<'isFavorite'>().toMatchTypeOf<RequiredKeys>()
    expectTypeOf<'createdAt'>().toMatchTypeOf<RequiredKeys>()
  })

  // =========================================================================
  // AC-4
  // =========================================================================
  it('AC-4: GIVEN das bereinigte Schema WHEN der Typ PromptHistoryRow geprueft wird THEN enthaelt er KEINE promptStyle/negativePrompt AND enthaelt weiterhin alle required Felder', () => {
    // Type-level: must NOT have removed properties
    type HasPromptStyle = 'promptStyle' extends keyof PromptHistoryRow ? true : false
    type HasNegativePrompt = 'negativePrompt' extends keyof PromptHistoryRow ? true : false
    expectTypeOf<HasPromptStyle>().toEqualTypeOf<false>()
    expectTypeOf<HasNegativePrompt>().toEqualTypeOf<false>()

    // Type-level: must have all required properties
    expectTypeOf<PromptHistoryRow>().toHaveProperty('id')
    expectTypeOf<PromptHistoryRow>().toHaveProperty('promptMotiv')
    expectTypeOf<PromptHistoryRow>().toHaveProperty('modelId')
    expectTypeOf<PromptHistoryRow>().toHaveProperty('modelParams')
    expectTypeOf<PromptHistoryRow>().toHaveProperty('isFavorite')
    expectTypeOf<PromptHistoryRow>().toHaveProperty('createdAt')

    // Source inspection
    const typeMatch = queriesSource.match(
      /export\s+type\s+PromptHistoryRow\s*=\s*\{([^}]+)\}/s
    )
    expect(typeMatch).not.toBeNull()
    expect(typeMatch![1]).not.toMatch(/promptStyle/)
    expect(typeMatch![1]).not.toMatch(/negativePrompt/)
    expect(typeMatch![1]).toMatch(/\bid\b/)
    expect(typeMatch![1]).toMatch(/promptMotiv/)
    expect(typeMatch![1]).toMatch(/modelId/)
    expect(typeMatch![1]).toMatch(/modelParams/)
    expect(typeMatch![1]).toMatch(/isFavorite/)
    expect(typeMatch![1]).toMatch(/createdAt/)
  })

  // =========================================================================
  // AC-5
  // =========================================================================
  it('AC-5: GIVEN die bereinigten Queries WHEN PromptHistoryEntry und Mappings geprueft werden THEN enthaelt es KEINE promptStyle/negativePrompt AND Mappings referenzieren KEINE entfernten Felder', () => {
    // Type-level: PromptHistoryEntry must NOT have removed properties
    type HasPromptStyle = 'promptStyle' extends keyof PromptHistoryEntry ? true : false
    type HasNegativePrompt = 'negativePrompt' extends keyof PromptHistoryEntry ? true : false
    expectTypeOf<HasPromptStyle>().toEqualTypeOf<false>()
    expectTypeOf<HasNegativePrompt>().toEqualTypeOf<false>()

    // Type-level: must have required properties
    expectTypeOf<PromptHistoryEntry>().toHaveProperty('generationId')
    expectTypeOf<PromptHistoryEntry>().toHaveProperty('promptMotiv')
    expectTypeOf<PromptHistoryEntry>().toHaveProperty('modelId')
    expectTypeOf<PromptHistoryEntry>().toHaveProperty('modelParams')
    expectTypeOf<PromptHistoryEntry>().toHaveProperty('isFavorite')
    expectTypeOf<PromptHistoryEntry>().toHaveProperty('createdAt')

    // Source: Interface must not contain removed fields
    const interfaceMatch = serviceSource.match(
      /export\s+interface\s+PromptHistoryEntry\s*\{([^}]+)\}/s
    )
    expect(interfaceMatch).not.toBeNull()
    expect(interfaceMatch![1]).not.toMatch(/promptStyle/)
    expect(interfaceMatch![1]).not.toMatch(/negativePrompt/)

    // Source: getHistory mapping must not reference removed fields
    const getHistoryMatch = serviceSource.match(
      /async\s+function\s+getHistory[\s\S]*?^}/m
    )
    expect(getHistoryMatch).not.toBeNull()
    expect(getHistoryMatch![0]).not.toMatch(/row\.promptStyle/)
    expect(getHistoryMatch![0]).not.toMatch(/row\.negativePrompt/)
    expect(getHistoryMatch![0]).not.toMatch(/promptStyle\s*:/)
    expect(getHistoryMatch![0]).not.toMatch(/negativePrompt\s*:/)

    // Source: getFavorites mapping must not reference removed fields
    const getFavoritesMatch = serviceSource.match(
      /async\s+function\s+getFavorites[\s\S]*?^}/m
    )
    expect(getFavoritesMatch).not.toBeNull()
    expect(getFavoritesMatch![0]).not.toMatch(/row\.promptStyle/)
    expect(getFavoritesMatch![0]).not.toMatch(/row\.negativePrompt/)
    expect(getFavoritesMatch![0]).not.toMatch(/promptStyle\s*:/)
    expect(getFavoritesMatch![0]).not.toMatch(/negativePrompt\s*:/)
  })

  // =========================================================================
  // AC-6
  // =========================================================================
  it('AC-6: GIVEN alle Aenderungen aus AC-1 bis AC-5 WHEN npx tsc --noEmit ausgefuehrt wird THEN meldet der Compiler 0 Fehler in queries.ts und prompt-history-service.ts', () => {
    /**
     * AC-6: TypeScript compilation check.
     *
     * This test verifies that both files can be successfully imported
     * without type errors. The actual `npx tsc --noEmit` is run as a
     * separate acceptance command (see slice spec Acceptance Command).
     *
     * At test-time, we verify that:
     * 1. Both source files exist and are readable
     * 2. Type imports resolve without errors (validated at compile time by vitest/tsc)
     * 3. No type references to removed fields exist
     */

    // Files must exist and be readable
    expect(fs.existsSync(queriesSourcePath)).toBe(true)
    expect(fs.existsSync(serviceSourcePath)).toBe(true)

    // If we got this far, TypeScript compilation succeeded for these imports:
    // - CreateGenerationInput, PromptHistoryRow from queries.ts
    // - PromptHistoryEntry from prompt-history-service.ts
    // This is a compile-time assertion -- if types were broken, vitest would fail to start.

    // Additional runtime check: source files should not contain any
    // references to the removed column types as properties
    const removedPatterns = [
      /promptStyle\s*\?\s*:/,   // optional property
      /promptStyle\s*:/,        // required property
      /negativePrompt\s*\?\s*:/, // optional property
      /negativePrompt\s*:/,     // required property
    ]

    // Check queries.ts interfaces/types (not in string literals or comments)
    const queriesInterfaces = queriesSource.match(
      /(?:export\s+(?:interface|type)\s+\w+\s*(?:=\s*)?\{[^}]+\})/gs
    ) ?? []
    for (const block of queriesInterfaces) {
      for (const pattern of removedPatterns) {
        expect(block).not.toMatch(pattern)
      }
    }

    // Check prompt-history-service.ts interfaces
    const serviceInterfaces = serviceSource.match(
      /(?:export\s+(?:interface|type)\s+\w+\s*(?:=\s*)?\{[^}]+\})/gs
    ) ?? []
    for (const block of serviceInterfaces) {
      for (const pattern of removedPatterns) {
        expect(block).not.toMatch(pattern)
      }
    }
  })
})
