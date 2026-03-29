import { describe, it, expect, expectTypeOf } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Unit Tests for Slice 02 (Phase 7): DB Queries -- Prompt Field Removal
 *
 * These tests validate that `queries.ts` interfaces, types, and query functions
 * no longer reference the removed columns `promptStyle` and `negativePrompt`.
 *
 * Mocking Strategy: mock_external (per Slice-Spec)
 * Approach: source-code inspection + type-level checks. No DB connection needed.
 */

// Read the queries source file once for all source-inspection tests
const queriesSourcePath = path.resolve(__dirname, '..', 'queries.ts')
const queriesSource = fs.readFileSync(queriesSourcePath, 'utf-8')

// ---------------------------------------------------------------------------
// Import types for type-level assertions
// ---------------------------------------------------------------------------
import type { CreateGenerationInput, PromptHistoryRow } from '../queries'

describe('queries - prompt field removal', () => {
  // =========================================================================
  // AC-1: CreateGenerationInput hat kein promptStyle/negativePrompt
  // =========================================================================

  it('AC-1: should not include promptStyle in CreateGenerationInput', () => {
    /**
     * AC-1: GIVEN das bereinigte Schema aus Slice 01 (ohne promptStyle/negativePrompt)
     *       WHEN das Interface CreateGenerationInput in queries.ts geprueft wird
     *       THEN enthaelt es KEINE Property promptStyle oder promptStyle?
     */

    // Type-level check: promptStyle must not be a key of CreateGenerationInput
    type HasPromptStyle = 'promptStyle' extends keyof CreateGenerationInput ? true : false
    expectTypeOf<HasPromptStyle>().toEqualTypeOf<false>()

    // Runtime: extract the interface source block and verify no promptStyle property
    const interfaceMatch = queriesSource.match(
      /export\s+interface\s+CreateGenerationInput\s*\{([^}]+)\}/s
    )
    expect(interfaceMatch).not.toBeNull()
    const interfaceBody = interfaceMatch![1]
    expect(interfaceBody).not.toMatch(/promptStyle/)
  })

  it('AC-1: should not include negativePrompt in CreateGenerationInput', () => {
    /**
     * AC-1: GIVEN das bereinigte Schema aus Slice 01 (ohne promptStyle/negativePrompt)
     *       WHEN das Interface CreateGenerationInput in queries.ts geprueft wird
     *       THEN enthaelt es KEINE Property negativePrompt
     */

    // Type-level check
    type HasNegativePrompt = 'negativePrompt' extends keyof CreateGenerationInput ? true : false
    expectTypeOf<HasNegativePrompt>().toEqualTypeOf<false>()

    // Runtime source inspection
    const interfaceMatch = queriesSource.match(
      /export\s+interface\s+CreateGenerationInput\s*\{([^}]+)\}/s
    )
    expect(interfaceMatch).not.toBeNull()
    const interfaceBody = interfaceMatch![1]
    expect(interfaceBody).not.toMatch(/negativePrompt/)
  })

  it('AC-1: createGeneration insert should not reference removed columns', () => {
    /**
     * AC-1: GIVEN das bereinigte Schema aus Slice 01 (ohne promptStyle/negativePrompt)
     *       WHEN der createGeneration-Insert in queries.ts geprueft wird
     *       THEN referenziert er KEINE der entfernten Spalten
     */

    // Extract the createGeneration function body
    const fnMatch = queriesSource.match(
      /export\s+async\s+function\s+createGeneration\s*\([^)]*\)[^{]*\{([\s\S]*?)^}/m
    )
    expect(fnMatch).not.toBeNull()
    const fnBody = fnMatch![1]

    // Must not reference removed fields in the insert values
    expect(fnBody).not.toMatch(/promptStyle/)
    expect(fnBody).not.toMatch(/negativePrompt/)
    expect(fnBody).not.toMatch(/prompt_style/)
    expect(fnBody).not.toMatch(/negative_prompt/)
  })

  // =========================================================================
  // AC-2: getPromptHistoryQuery DISTINCT ON nur prompt_motiv + model_id
  // =========================================================================

  it('AC-2: should use DISTINCT ON with only prompt_motiv and model_id', () => {
    /**
     * AC-2: GIVEN das bereinigte Schema aus Slice 01
     *       WHEN getPromptHistoryQuery ausgefuehrt wird
     *       THEN verwendet die SQL-Query DISTINCT ON (g.prompt_motiv, g.model_id) (nur 2 Felder statt 4)
     */

    // Extract the getPromptHistoryQuery function body
    const fnMatch = queriesSource.match(
      /export\s+async\s+function\s+getPromptHistoryQuery[\s\S]*?^}/m
    )
    expect(fnMatch).not.toBeNull()
    const fnBody = fnMatch![0]

    // Must have DISTINCT ON with exactly prompt_motiv and model_id
    const distinctOnMatch = fnBody.match(/DISTINCT\s+ON\s*\(([^)]+)\)/i)
    expect(distinctOnMatch).not.toBeNull()

    const distinctFields = distinctOnMatch![1]
      .split(',')
      .map((f: string) => f.trim())
    expect(distinctFields).toHaveLength(2)
    expect(distinctFields[0]).toMatch(/g\.prompt_motiv/)
    expect(distinctFields[1]).toMatch(/g\.model_id/)

    // Must NOT contain prompt_style or negative_prompt in DISTINCT ON
    expect(distinctFields.join(',')).not.toMatch(/prompt_style/)
    expect(distinctFields.join(',')).not.toMatch(/negative_prompt/)
  })

  it('AC-2: should not select prompt_style or negative_prompt in history query', () => {
    /**
     * AC-2: GIVEN das bereinigte Schema aus Slice 01
     *       WHEN getPromptHistoryQuery ausgefuehrt wird
     *       THEN enthaelt die SELECT-Clause KEINE Spalten prompt_style oder negative_prompt
     */

    // Extract the getPromptHistoryQuery function body
    const fnMatch = queriesSource.match(
      /export\s+async\s+function\s+getPromptHistoryQuery[\s\S]*?^}/m
    )
    expect(fnMatch).not.toBeNull()
    const fnBody = fnMatch![0]

    // The SELECT clause must not reference removed columns
    expect(fnBody).not.toMatch(/prompt_style/)
    expect(fnBody).not.toMatch(/negative_prompt/)
    expect(fnBody).not.toMatch(/promptStyle/)
    expect(fnBody).not.toMatch(/negativePrompt/)
  })

  it('AC-2: ORDER BY in DISTINCT ON subquery should contain only prompt_motiv and model_id', () => {
    /**
     * AC-2: GIVEN das bereinigte Schema aus Slice 01
     *       WHEN getPromptHistoryQuery ausgefuehrt wird
     *       THEN enthaelt die ORDER BY-Clause im DISTINCT ON-Subquery nur g.prompt_motiv, g.model_id
     */

    // Extract the getPromptHistoryQuery function body
    const fnMatch = queriesSource.match(
      /export\s+async\s+function\s+getPromptHistoryQuery[\s\S]*?^}/m
    )
    expect(fnMatch).not.toBeNull()
    const fnBody = fnMatch![0]

    // Find the first ORDER BY inside the subquery (before the closing parenthesis of the subquery)
    // The subquery ORDER BY should be: ORDER BY g.prompt_motiv, g.model_id, g.created_at DESC
    const subqueryMatch = fnBody.match(
      /SELECT\s+DISTINCT\s+ON[\s\S]*?ORDER\s+BY\s+([^\n]+)/i
    )
    expect(subqueryMatch).not.toBeNull()

    const orderByClause = subqueryMatch![1]
    // Should contain only prompt_motiv and model_id (plus created_at for tiebreaking)
    // Must NOT contain prompt_style or negative_prompt
    expect(orderByClause).not.toMatch(/prompt_style/)
    expect(orderByClause).not.toMatch(/negative_prompt/)
    expect(orderByClause).toMatch(/g\.prompt_motiv/)
    expect(orderByClause).toMatch(/g\.model_id/)
  })

  // =========================================================================
  // AC-3: getFavoritesQuery Select ohne entfernte Spalten
  // =========================================================================

  it('AC-3: should not reference promptStyle or negativePrompt in favorites select', () => {
    /**
     * AC-3: GIVEN das bereinigte Schema aus Slice 01
     *       WHEN getFavoritesQuery ausgefuehrt wird
     *       THEN enthaelt der .select()-Aufruf KEINE Referenzen auf
     *            generations.promptStyle oder generations.negativePrompt
     */

    // Extract the getFavoritesQuery function body
    const fnMatch = queriesSource.match(
      /export\s+async\s+function\s+getFavoritesQuery[\s\S]*?^}/m
    )
    expect(fnMatch).not.toBeNull()
    const fnBody = fnMatch![0]

    // Must not reference removed fields
    expect(fnBody).not.toMatch(/generations\.promptStyle/)
    expect(fnBody).not.toMatch(/generations\.negativePrompt/)
    expect(fnBody).not.toMatch(/promptStyle\s*:/)
    expect(fnBody).not.toMatch(/negativePrompt\s*:/)

    // Should still have the required fields in .select()
    expect(fnBody).toMatch(/generations\.id/)
    expect(fnBody).toMatch(/generations\.promptMotiv/)
    expect(fnBody).toMatch(/generations\.modelId/)
    expect(fnBody).toMatch(/generations\.modelParams/)
    expect(fnBody).toMatch(/generations\.isFavorite/)
    expect(fnBody).toMatch(/generations\.createdAt/)
  })

  it('AC-3: getFavoritesQuery result should still have required fields', () => {
    /**
     * AC-3: GIVEN das bereinigte Schema aus Slice 01
     *       WHEN getFavoritesQuery ausgefuehrt wird
     *       THEN hat das Ergebnis weiterhin die Felder id, promptMotiv, modelId, modelParams, isFavorite, createdAt
     */

    // The return type is PromptHistoryRow[] -- verify required fields via type
    type RequiredKeys = keyof PromptHistoryRow
    expectTypeOf<'id'>().toMatchTypeOf<RequiredKeys>()
    expectTypeOf<'promptMotiv'>().toMatchTypeOf<RequiredKeys>()
    expectTypeOf<'modelId'>().toMatchTypeOf<RequiredKeys>()
    expectTypeOf<'modelParams'>().toMatchTypeOf<RequiredKeys>()
    expectTypeOf<'isFavorite'>().toMatchTypeOf<RequiredKeys>()
    expectTypeOf<'createdAt'>().toMatchTypeOf<RequiredKeys>()
  })

  // =========================================================================
  // AC-4: PromptHistoryRow Typ ohne entfernte Properties
  // =========================================================================

  it('AC-4: should not include promptStyle or negativePrompt in PromptHistoryRow type', () => {
    /**
     * AC-4: GIVEN das bereinigte Schema aus Slice 01
     *       WHEN der Typ PromptHistoryRow in queries.ts geprueft wird
     *       THEN enthaelt er KEINE Properties promptStyle oder negativePrompt
     */

    // Type-level checks
    type HasPromptStyle = 'promptStyle' extends keyof PromptHistoryRow ? true : false
    type HasNegativePrompt = 'negativePrompt' extends keyof PromptHistoryRow ? true : false

    expectTypeOf<HasPromptStyle>().toEqualTypeOf<false>()
    expectTypeOf<HasNegativePrompt>().toEqualTypeOf<false>()

    // Runtime source inspection of the type definition
    const typeMatch = queriesSource.match(
      /export\s+type\s+PromptHistoryRow\s*=\s*\{([^}]+)\}/s
    )
    expect(typeMatch).not.toBeNull()
    const typeBody = typeMatch![1]
    expect(typeBody).not.toMatch(/promptStyle/)
    expect(typeBody).not.toMatch(/negativePrompt/)
  })

  it('AC-4: PromptHistoryRow should still contain required fields', () => {
    /**
     * AC-4: GIVEN das bereinigte Schema aus Slice 01
     *       WHEN der Typ PromptHistoryRow in queries.ts geprueft wird
     *       THEN enthaelt er weiterhin id, promptMotiv, modelId, modelParams, isFavorite, createdAt
     */

    // Type-level: verify all required properties exist
    expectTypeOf<PromptHistoryRow>().toHaveProperty('id')
    expectTypeOf<PromptHistoryRow>().toHaveProperty('promptMotiv')
    expectTypeOf<PromptHistoryRow>().toHaveProperty('modelId')
    expectTypeOf<PromptHistoryRow>().toHaveProperty('modelParams')
    expectTypeOf<PromptHistoryRow>().toHaveProperty('isFavorite')
    expectTypeOf<PromptHistoryRow>().toHaveProperty('createdAt')

    // Type-level: verify types of required fields
    expectTypeOf<PromptHistoryRow['id']>().toEqualTypeOf<string>()
    expectTypeOf<PromptHistoryRow['promptMotiv']>().toEqualTypeOf<string>()
    expectTypeOf<PromptHistoryRow['modelId']>().toEqualTypeOf<string>()
    expectTypeOf<PromptHistoryRow['isFavorite']>().toEqualTypeOf<boolean>()
    expectTypeOf<PromptHistoryRow['createdAt']>().toEqualTypeOf<Date>()

    // Runtime source inspection
    const typeMatch = queriesSource.match(
      /export\s+type\s+PromptHistoryRow\s*=\s*\{([^}]+)\}/s
    )
    expect(typeMatch).not.toBeNull()
    const typeBody = typeMatch![1]
    expect(typeBody).toMatch(/\bid\b/)
    expect(typeBody).toMatch(/promptMotiv/)
    expect(typeBody).toMatch(/modelId/)
    expect(typeBody).toMatch(/modelParams/)
    expect(typeBody).toMatch(/isFavorite/)
    expect(typeBody).toMatch(/createdAt/)
  })
})
