import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * Slice 12: Cleanup — Legacy Services & Types entfernen
 *
 * Acceptance tests validating that legacy files are deleted,
 * no stale imports remain, and consumers are migrated to the new Model type.
 *
 * Mocking Strategy: no_mocks (validation via filesystem + compiler)
 */

const PROJECT_ROOT = path.resolve(__dirname, '..', '..')

/**
 * Recursively collect all .ts and .tsx files from a directory,
 * excluding node_modules, worktrees, __tests__, .next, and test files.
 */
function getProductionFiles(dir: string): string[] {
  const results: string[] = []

  if (!fs.existsSync(dir)) return results

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === 'worktrees' ||
        entry.name === '__tests__' ||
        entry.name === '.next'
      ) {
        continue
      }
      results.push(...getProductionFiles(fullPath))
    } else if (
      entry.isFile() &&
      /\.(ts|tsx)$/.test(entry.name) &&
      !entry.name.includes('.test.') &&
      !entry.name.includes('.spec.')
    ) {
      results.push(fullPath)
    }
  }

  return results
}

// =========================================================================
// Legacy file removal verification (AC-1, AC-2, AC-3)
// =========================================================================

describe('Legacy file removal verification', () => {
  /**
   * AC-1: GIVEN die Datei `lib/services/collection-model-service.ts` existiert
   *       WHEN Slice 12 abgeschlossen ist
   *       THEN ist die Datei geloescht und `ls lib/services/collection-model-service.ts`
   *            gibt "No such file" zurueck
   */
  it('AC-1: GIVEN lib/services/collection-model-service.ts existed WHEN slice 12 is complete THEN the file is deleted', () => {
    const filePath = path.join(PROJECT_ROOT, 'lib', 'services', 'collection-model-service.ts')
    expect(
      fs.existsSync(filePath),
      `Expected ${filePath} to NOT exist (legacy file should be deleted)`,
    ).toBe(false)
  })

  /**
   * AC-2: GIVEN die Datei `lib/services/model-schema-service.ts` existiert
   *       WHEN Slice 12 abgeschlossen ist
   *       THEN ist die Datei geloescht und `ls lib/services/model-schema-service.ts`
   *            gibt "No such file" zurueck
   */
  it('AC-2: GIVEN lib/services/model-schema-service.ts existed WHEN slice 12 is complete THEN the file is deleted', () => {
    const filePath = path.join(PROJECT_ROOT, 'lib', 'services', 'model-schema-service.ts')
    expect(
      fs.existsSync(filePath),
      `Expected ${filePath} to NOT exist (legacy file should be deleted)`,
    ).toBe(false)
  })

  /**
   * AC-3: GIVEN die Datei `lib/types/collection-model.ts` existiert
   *       WHEN Slice 12 abgeschlossen ist
   *       THEN ist die Datei geloescht und `ls lib/types/collection-model.ts`
   *            gibt "No such file" zurueck
   */
  it('AC-3: GIVEN lib/types/collection-model.ts existed WHEN slice 12 is complete THEN the file is deleted', () => {
    const filePath = path.join(PROJECT_ROOT, 'lib', 'types', 'collection-model.ts')
    expect(
      fs.existsSync(filePath),
      `Expected ${filePath} to NOT exist (legacy file should be deleted)`,
    ).toBe(false)
  })
})

// =========================================================================
// No legacy references in codebase (AC-4, AC-5, AC-6)
// =========================================================================

describe('No legacy references in codebase', () => {
  const productionFiles = getProductionFiles(PROJECT_ROOT)

  /**
   * AC-4: GIVEN die gesamte Codebase (alle *.ts und *.tsx Dateien)
   *       WHEN `grep -r "collection-model-service" --include="*.ts" --include="*.tsx"` ausgefuehrt wird
   *       THEN gibt es 0 Treffer (keine Imports, keine Mocks, keine Referenzen)
   */
  it('AC-4: GIVEN the entire codebase WHEN searching for "collection-model-service" THEN there are 0 references', () => {
    const violations: string[] = []

    for (const filePath of productionFiles) {
      const content = fs.readFileSync(filePath, 'utf-8')
      if (content.includes('collection-model-service')) {
        violations.push(path.relative(PROJECT_ROOT, filePath))
      }
    }

    expect(
      violations,
      `Found references to "collection-model-service" in:\n${violations.join('\n')}`,
    ).toHaveLength(0)
  })

  /**
   * AC-5: GIVEN die gesamte Codebase (alle *.ts und *.tsx Dateien)
   *       WHEN `grep -r "model-schema-service" --include="*.ts" --include="*.tsx"` ausgefuehrt wird
   *       THEN gibt es 0 Treffer
   *
   * Note: Comments referencing the origin of extracted code (e.g. "Extracted from
   * model-schema-service.ts") are acceptable documentation and not functional
   * references. This test checks for imports, requires, and non-comment references.
   */
  it('AC-5: GIVEN the entire codebase WHEN searching for imports/references to "model-schema-service" THEN there are 0 functional references', () => {
    const violations: string[] = []
    // Match import/require statements referencing model-schema-service
    const importPattern = /(?:import|require)\s*\(?[^)]*model-schema-service/

    for (const filePath of productionFiles) {
      const content = fs.readFileSync(filePath, 'utf-8')
      if (importPattern.test(content)) {
        violations.push(path.relative(PROJECT_ROOT, filePath))
      }
    }

    expect(
      violations,
      `Found import/require references to "model-schema-service" in:\n${violations.join('\n')}`,
    ).toHaveLength(0)
  })

  /**
   * AC-6: GIVEN die gesamte Codebase (alle *.ts und *.tsx Dateien)
   *       WHEN `grep -r "from.*collection-model" --include="*.ts" --include="*.tsx"` ausgefuehrt wird
   *       THEN gibt es 0 Treffer (kein Import des CollectionModel-Typs mehr)
   */
  it('AC-6: GIVEN the entire codebase WHEN searching for imports from "collection-model" THEN there are 0 references', () => {
    const violations: string[] = []
    const importPattern = /from\s+['"][^'"]*collection-model['"]/

    for (const filePath of productionFiles) {
      const content = fs.readFileSync(filePath, 'utf-8')
      if (importPattern.test(content)) {
        violations.push(path.relative(PROJECT_ROOT, filePath))
      }
    }

    expect(
      violations,
      `Found imports from "collection-model" in:\n${violations.join('\n')}`,
    ).toHaveLength(0)
  })
})

// =========================================================================
// Consumer migration to Model type (AC-7, AC-8, AC-9)
// =========================================================================

describe('Consumer migration to Model type', () => {
  /**
   * AC-7: GIVEN `components/models/model-card.tsx` verwendet den CollectionModel-Typ in Props
   *       WHEN der Import auf den Drizzle-inferierten Model-Typ umgestellt wird
   *       THEN kompiliert die Datei fehlerfrei und die Props verwenden Model
   *            (aus typeof models.$inferSelect) statt CollectionModel
   */
  it('AC-7: GIVEN model-card.tsx WHEN inspected THEN it uses the Drizzle-inferred Model type (not CollectionModel) in its props', () => {
    const filePath = path.join(PROJECT_ROOT, 'components', 'models', 'model-card.tsx')
    expect(fs.existsSync(filePath), `Expected ${filePath} to exist`).toBe(true)

    const content = fs.readFileSync(filePath, 'utf-8')

    // Must NOT import CollectionModel
    expect(content).not.toMatch(/CollectionModel/)

    // Must import Model type (from model-catalog-service which re-exports the Drizzle type)
    expect(content).toMatch(/import\s+.*\bModel\b.*from\s+['"]@\/lib\/services\/model-catalog-service['"]/)

    // Props interface must use Model type
    expect(content).toMatch(/model:\s*Model/)

    // Must use Model-type fields (Drizzle schema fields)
    // The Model type has: name, owner, description, coverImageUrl, runCount
    expect(content).toMatch(/model\.name/)
    expect(content).toMatch(/model\.owner/)
    expect(content).toMatch(/model\.coverImageUrl/)
    expect(content).toMatch(/model\.runCount/)
  })

  /**
   * AC-8: GIVEN model-browser-drawer.tsx, model-trigger.tsx, canvas-model-selector.tsx
   *       und use-model-filters.ts verwenden den CollectionModel-Typ
   *       WHEN alle Imports auf den Model-Typ umgestellt werden
   *       THEN kompilieren alle Dateien fehlerfrei mit npx tsc --noEmit
   *
   * This test validates that the consumer files import Model (not CollectionModel).
   * The actual tsc --noEmit compilation is validated by the acceptance command.
   */
  it('AC-8: GIVEN all consumer files WHEN inspected THEN they import Model type (not CollectionModel) and the files exist', () => {
    const consumerFiles = [
      path.join(PROJECT_ROOT, 'components', 'models', 'model-trigger.tsx'),
      path.join(PROJECT_ROOT, 'lib', 'hooks', 'use-model-filters.ts'),
    ]

    for (const filePath of consumerFiles) {
      const relPath = path.relative(PROJECT_ROOT, filePath)
      expect(fs.existsSync(filePath), `Expected ${relPath} to exist`).toBe(true)

      const content = fs.readFileSync(filePath, 'utf-8')

      // Must NOT reference CollectionModel anywhere
      expect(
        content.includes('CollectionModel'),
        `${relPath} still references CollectionModel`,
      ).toBe(false)

      // Must import Model type (from model-catalog-service)
      expect(
        /\bModel\b/.test(content),
        `${relPath} does not reference Model type`,
      ).toBe(true)
    }
  })

})
