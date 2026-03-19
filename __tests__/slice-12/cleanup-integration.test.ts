import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * Slice 12: Cleanup — Integration Tests
 *
 * These tests verify the integration-level correctness of the cleanup migration:
 * - Model type re-export chain is intact (queries.ts -> model-catalog-service.ts -> consumers)
 * - No broken import chains exist
 * - The codebase is free from ALL CollectionModel references (not just the 3 deleted files)
 *
 * Mocking Strategy: no_mocks
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
// Model type re-export chain
// =========================================================================

describe('Model type re-export chain integrity', () => {
  it('should have queries.ts defining Model as typeof models.$inferSelect', () => {
    const filePath = path.join(PROJECT_ROOT, 'lib', 'db', 'queries.ts')
    expect(fs.existsSync(filePath)).toBe(true)

    const content = fs.readFileSync(filePath, 'utf-8')

    // queries.ts should define Model type from Drizzle schema inference
    expect(content).toMatch(/export\s+type\s+Model\s*=\s*typeof\s+models\.\$inferSelect/)
  })

  it('should have model-catalog-service.ts re-exporting Model from queries', () => {
    const filePath = path.join(PROJECT_ROOT, 'lib', 'services', 'model-catalog-service.ts')
    expect(fs.existsSync(filePath)).toBe(true)

    const content = fs.readFileSync(filePath, 'utf-8')

    // model-catalog-service should re-export Model
    expect(content).toMatch(/export\s+type\s*\{\s*Model\s*\}/)
  })

  it('should have all consumer files importing Model from model-catalog-service', () => {
    const consumerFiles = [
      'components/models/model-card.tsx',
      'components/models/model-trigger.tsx',
      'components/models/model-browser-drawer.tsx',
      'components/canvas/canvas-model-selector.tsx',
      'lib/hooks/use-model-filters.ts',
    ]

    for (const relPath of consumerFiles) {
      const filePath = path.join(PROJECT_ROOT, relPath)
      expect(fs.existsSync(filePath), `Expected ${relPath} to exist`).toBe(true)

      const content = fs.readFileSync(filePath, 'utf-8')

      // Each consumer should import Model from model-catalog-service
      const hasModelImport =
        /from\s+['"]@\/lib\/services\/model-catalog-service['"]/.test(content) ||
        /from\s+['"]@\/lib\/db\/queries['"]/.test(content)

      expect(
        hasModelImport,
        `${relPath} does not import from model-catalog-service or queries`,
      ).toBe(true)
    }
  })
})

// =========================================================================
// Complete CollectionModel elimination from production code
// =========================================================================

describe('Complete CollectionModel elimination', () => {
  const productionFiles = getProductionFiles(PROJECT_ROOT)

  it('should have zero occurrences of "CollectionModel" type name in any production file', () => {
    const violations: string[] = []

    for (const filePath of productionFiles) {
      const content = fs.readFileSync(filePath, 'utf-8')
      if (/\bCollectionModel\b/.test(content)) {
        violations.push(path.relative(PROJECT_ROOT, filePath))
      }
    }

    expect(
      violations,
      `Found references to "CollectionModel" in:\n${violations.join('\n')}`,
    ).toHaveLength(0)
  })

  it('should have zero occurrences of legacy function "getCollectionModels" in any production file', () => {
    const violations: string[] = []

    for (const filePath of productionFiles) {
      const content = fs.readFileSync(filePath, 'utf-8')
      if (/\bgetCollectionModels\b/.test(content)) {
        violations.push(path.relative(PROJECT_ROOT, filePath))
      }
    }

    expect(
      violations,
      `Found references to "getCollectionModels" in:\n${violations.join('\n')}`,
    ).toHaveLength(0)
  })

  it('should have zero occurrences of legacy function "checkImg2ImgSupport" in any production file', () => {
    const violations: string[] = []

    for (const filePath of productionFiles) {
      const content = fs.readFileSync(filePath, 'utf-8')
      if (/\bcheckImg2ImgSupport\b/.test(content)) {
        violations.push(path.relative(PROJECT_ROOT, filePath))
      }
    }

    expect(
      violations,
      `Found references to "checkImg2ImgSupport" in:\n${violations.join('\n')}`,
    ).toHaveLength(0)
  })
})

// =========================================================================
// canvas-model-selector.tsx: getModels integration with server actions
// =========================================================================

describe('canvas-model-selector.tsx — Server Action integration', () => {
  const filePath = path.join(PROJECT_ROOT, 'components', 'canvas', 'canvas-model-selector.tsx')

  it('should import getModels from app/actions/models (the Slice 06 server action)', () => {
    expect(fs.existsSync(filePath)).toBe(true)
    const content = fs.readFileSync(filePath, 'utf-8')

    // Must import getModels from the server action module
    expect(content).toMatch(/import\s+\{[^}]*\bgetModels\b[^}]*\}\s+from\s+['"]@\/app\/actions\/models['"]/)
  })

  it('should import Model type from model-catalog-service (not from collection-model)', () => {
    expect(fs.existsSync(filePath)).toBe(true)
    const content = fs.readFileSync(filePath, 'utf-8')

    expect(content).toMatch(/import\s+.*\bModel\b.*from\s+['"]@\/lib\/services\/model-catalog-service['"]/)
    expect(content).not.toMatch(/from\s+['"][^'"]*collection-model['"]/)
  })
})

// =========================================================================
// No legacy service patterns remaining
// =========================================================================

describe('No legacy service patterns remaining', () => {
  const productionFiles = getProductionFiles(PROJECT_ROOT)

  it('should have no "in-memory Map cache" patterns from legacy collection-model-service', () => {
    const violations: string[] = []

    for (const filePath of productionFiles) {
      // Only check files in lib/services
      const relPath = path.relative(PROJECT_ROOT, filePath)
      if (!relPath.startsWith('lib' + path.sep + 'services')) continue

      const content = fs.readFileSync(filePath, 'utf-8')
      // Legacy pattern: Map<string, CollectionModel> used for caching
      if (/new\s+Map\s*<\s*string\s*,\s*CollectionModel\s*>/.test(content)) {
        violations.push(relPath)
      }
    }

    expect(
      violations,
      `Found legacy Map cache patterns in:\n${violations.join('\n')}`,
    ).toHaveLength(0)
  })
})
