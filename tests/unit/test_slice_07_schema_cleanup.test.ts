import { describe, it, expect } from 'vitest'

/**
 * Unit tests for slice-07-legacy-cleanup: schema.ts cleanup verification
 *
 * These tests verify that the promptSnippets table definition has been
 * removed from the Drizzle schema, while all other tables remain intact.
 */

import * as schemaModule from '@/lib/db/schema'

describe('schema.ts after legacy cleanup', () => {
  /**
   * AC-6: GIVEN lib/db/schema.ts definiert die Tabelle promptSnippets
   *       WHEN der Implementer den Slice abschliesst
   *       THEN ist die promptSnippets Tabellendefinition und ihr Export aus schema.ts entfernt
   */
  it('AC-6: should NOT export promptSnippets', () => {
    const exportedKeys = Object.keys(schemaModule)

    expect(exportedKeys).not.toContain('promptSnippets')
  })

  it('AC-6: should still export projects table', () => {
    expect(schemaModule.projects).toBeDefined()
  })

  it('AC-6: should still export generations table', () => {
    expect(schemaModule.generations).toBeDefined()
  })

  it('AC-6: should still export favoriteModels table', () => {
    expect(schemaModule.favoriteModels).toBeDefined()
  })

  it('AC-6: should still export projectSelectedModels table', () => {
    expect(schemaModule.projectSelectedModels).toBeDefined()
  })
})
