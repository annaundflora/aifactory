import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * Recursively collect all .ts and .tsx files from a directory,
 * excluding node_modules, worktrees, __tests__, and .test. files.
 */
function getProductionFiles(dir: string): string[] {
  const results: string[] = []

  if (!fs.existsSync(dir)) return results

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    // Skip non-production directories
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

const PROJECT_ROOT = path.resolve(__dirname, '..')

describe('Dead Code Cleanup - No Stale Imports in Production Code', () => {
  /**
   * AC-7: GIVEN das gesamte Projekt (ausgenommen `worktrees/` und `node_modules/`)
   * WHEN nach Imports von `getFavoriteModels`, `toggleFavoriteModel`,
   *      `getProjectSelectedModels`, `saveProjectSelectedModels`,
   *      `getFavoriteModelIds`, `addFavoriteModel`, `removeFavoriteModel`,
   *      `getProjectSelectedModelIds`, `saveProjectSelectedModelIds`
   *      oder `UPSCALE_MODEL` gesucht wird
   * THEN gibt es KEINE produktiven Imports mehr
   */

  const productionFiles = getProductionFiles(PROJECT_ROOT)

  const deprecatedServerActions = [
    'getFavoriteModels',
    'toggleFavoriteModel',
    'getProjectSelectedModels',
    'saveProjectSelectedModels',
  ]

  const deprecatedQueryFunctions = [
    'getFavoriteModelIds',
    'addFavoriteModel',
    'removeFavoriteModel',
    'getProjectSelectedModelIds',
    'saveProjectSelectedModelIds',
  ]

  it('should have no imports of deprecated Server Actions in any production file', () => {
    const violations: string[] = []

    for (const filePath of productionFiles) {
      const content = fs.readFileSync(filePath, 'utf-8')
      for (const fnName of deprecatedServerActions) {
        // Match import statements containing the function name
        const importPattern = new RegExp(
          `import\\s+[^;]*\\b${fnName}\\b[^;]*from`,
        )
        if (importPattern.test(content)) {
          violations.push(`${path.relative(PROJECT_ROOT, filePath)}: imports ${fnName}`)
        }
      }
    }

    expect(
      violations,
      `Found production imports of deprecated server actions:\n${violations.join('\n')}`,
    ).toHaveLength(0)
  })

  it('should have no imports of deprecated query functions in any production file', () => {
    const violations: string[] = []

    for (const filePath of productionFiles) {
      const content = fs.readFileSync(filePath, 'utf-8')
      for (const fnName of deprecatedQueryFunctions) {
        const importPattern = new RegExp(
          `import\\s+[^;]*\\b${fnName}\\b[^;]*from`,
        )
        if (importPattern.test(content)) {
          violations.push(`${path.relative(PROJECT_ROOT, filePath)}: imports ${fnName}`)
        }
      }
    }

    expect(
      violations,
      `Found production imports of deprecated query functions:\n${violations.join('\n')}`,
    ).toHaveLength(0)
  })

  it('should have no imports of UPSCALE_MODEL in any production file', () => {
    const violations: string[] = []

    for (const filePath of productionFiles) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const importPattern = /import\s+[^;]*\bUPSCALE_MODEL\b[^;]*from/
      if (importPattern.test(content)) {
        violations.push(`${path.relative(PROJECT_ROOT, filePath)}: imports UPSCALE_MODEL`)
      }
    }

    expect(
      violations,
      `Found production imports of UPSCALE_MODEL:\n${violations.join('\n')}`,
    ).toHaveLength(0)
  })
})
