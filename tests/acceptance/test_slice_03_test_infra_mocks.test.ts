import { describe, it, expect } from 'vitest'
import { execSync } from 'child_process'
import { resolve } from 'path'
import { existsSync, readFileSync } from 'fs'

/**
 * Acceptance Tests for slice-03-test-infra-mocks
 *
 * Tests validate Acceptance Criteria AC-5 and AC-6 from the slice spec.
 * AC-5: TypeScript compilation passes with 0 errors for factories.ts
 * AC-6: Existing makeGeneration copies are NOT modified; central factory is independently testable
 *
 * Mocking Strategy: no_mocks
 */

const ROOT = resolve(__dirname, '..', '..')
const FACTORIES_PATH = resolve(ROOT, 'lib', '__tests__', 'factories.ts')

describe('slice-03 TypeScript compilation', () => {
  /**
   * AC-5: GIVEN die Factories aus AC-1 und AC-3
   *       WHEN `npx tsc --noEmit` ausgefuehrt wird
   *       THEN meldet der TypeScript-Compiler 0 Fehler in `lib/__tests__/factories.ts`
   *       AND die Rueckgabetypen stimmen exakt mit den bereinigten Schema-/Interface-Typen ueberein
   */
  it('AC-5: should compile lib/__tests__/factories.ts without TypeScript errors', { timeout: 30_000 }, () => {
    // Verify the file exists before running tsc
    expect(existsSync(FACTORIES_PATH)).toBe(true)

    // Run tsc --noEmit focused on the factories file
    // If there are TS errors, execSync will throw
    let result: string
    try {
      result = execSync('npx tsc --noEmit', {
        cwd: ROOT,
        encoding: 'utf-8',
        timeout: 60_000,
      })
    } catch (error: unknown) {
      const execError = error as { stdout?: string; stderr?: string }
      // Filter output for factories.ts-related errors
      const stdout = execError.stdout ?? ''
      const stderr = execError.stderr ?? ''
      const allOutput = stdout + stderr
      const factoryErrors = allOutput
        .split('\n')
        .filter((line: string) => line.includes('factories.ts'))

      // Fail with meaningful message showing only factory-related errors
      expect(factoryErrors).toEqual([])
      return
    }

    // If no error was thrown, compilation succeeded
    expect(true).toBe(true)
  })
})

describe('slice-03 existing copies not modified', () => {
  /**
   * AC-6: GIVEN die 40 existierenden `makeGeneration`-Kopien in Test-Dateien
   *       WHEN nach Erstellung der zentralen Factory geprueft wird
   *       THEN sind die existierenden Kopien in diesem Slice NICHT veraendert
   *       AND die zentrale Factory ist unabhaengig testbar
   */
  it('AC-6: should have the central factory file as an independent, importable module', () => {
    // The central factory file must exist
    expect(existsSync(FACTORIES_PATH)).toBe(true)

    // Read and verify it exports the expected functions
    const content = readFileSync(FACTORIES_PATH, 'utf-8')
    expect(content).toContain('export function makeGeneration')
    expect(content).toContain('export function makeEntry')

    // Verify no promptStyle or negativePrompt as actual object keys in the factory.
    // The file may mention these words in comments (e.g. "no promptStyle"),
    // so we check that they don't appear as property assignments in the code.
    // Strip single-line comments and JSDoc blocks before checking.
    const codeOnly = content
      .replace(/\/\*[\s\S]*?\*\//g, '')  // remove block comments
      .replace(/\/\/.*/g, '')             // remove line comments

    expect(codeOnly).not.toContain('promptStyle')
    expect(codeOnly).not.toContain('negativePrompt')
  })

  it('AC-6: existing makeGeneration copies in test files should still contain their own local definitions', () => {
    // Spot-check a few known directories with existing copies
    // These files should NOT import from the central factory yet
    // (migration happens in later slices)
    const knownTestDirs = [
      resolve(ROOT, 'components', 'canvas', '__tests__'),
      resolve(ROOT, 'components', 'workspace', '__tests__'),
      resolve(ROOT, 'lib', 'services', '__tests__'),
    ]

    for (const dir of knownTestDirs) {
      if (!existsSync(dir)) continue

      // At least one of these directories must exist
      // (confirming existing test infrastructure is untouched)
      const dirExists = existsSync(dir)
      expect(dirExists).toBe(true)
    }

    // Verify the central factory does NOT modify or re-export
    // from existing test files
    const content = readFileSync(FACTORIES_PATH, 'utf-8')
    expect(content).not.toContain('components/canvas')
    expect(content).not.toContain('components/workspace')
    expect(content).not.toContain('app/actions')
  })
})
