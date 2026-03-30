// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'
import { execSync } from 'child_process'

/**
 * Acceptance Tests for slice-15-cleanup-legacy
 *
 * This slice removes all legacy Tier-system artifacts: 4 source files deleted,
 * deprecated tier?/modelSettings? props removed from popovers, Tier/VALID_TIERS/
 * UpdateModelSettingInput removed from lib/types.ts, orphaned test files deleted.
 *
 * After this slice, `tsc --noEmit` must compile cleanly and no production code
 * may reference Tier artifacts.
 *
 * Mocking Strategy: no_mocks (per spec). All tests use filesystem inspection
 * and CLI commands against the real codebase.
 */

const ROOT = resolve(__dirname, '../..')

// ---------------------------------------------------------------------------
// Helper: recursively collect all .ts/.tsx files, excluding node_modules,
// specs/, drizzle/, and .next/
// ---------------------------------------------------------------------------
function collectTsTsxFiles(dir: string, results: string[] = []): string[] {
  const skipDirs = ['node_modules', 'specs', 'drizzle', '.next', '.git', '.claude']
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return results
  }
  for (const entry of entries) {
    if (skipDirs.includes(entry)) continue
    const fullPath = join(dir, entry)
    let stat
    try {
      stat = statSync(fullPath)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      collectTsTsxFiles(fullPath, results)
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      results.push(fullPath)
    }
  }
  return results
}

// ===========================================================================
// AC-1: Legacy-Dateien geloescht
// ===========================================================================
describe('AC-1: Legacy source files deleted', () => {
  /**
   * AC-1: GIVEN die Dateien components/ui/tier-toggle.tsx,
   *       components/ui/max-quality-toggle.tsx,
   *       lib/services/model-settings-service.ts,
   *       app/actions/model-settings.ts
   *       WHEN Slice 15 abgeschlossen ist
   *       THEN existiert KEINE dieser 4 Dateien mehr im Repository
   */
  const deletedFiles = [
    'components/ui/tier-toggle.tsx',
    'components/ui/max-quality-toggle.tsx',
    'lib/services/model-settings-service.ts',
    'app/actions/model-settings.ts',
  ]

  for (const file of deletedFiles) {
    it(`should confirm ${file} does not exist`, () => {
      expect(existsSync(resolve(ROOT, file))).toBe(false)
    })
  }
})

// ===========================================================================
// AC-2: Tier/VALID_TIERS/UpdateModelSettingInput removed from types.ts
// ===========================================================================
describe('AC-2: Legacy types removed from lib/types.ts', () => {
  /**
   * AC-2: GIVEN lib/types.ts
   *       WHEN die Datei inspiziert wird
   *       THEN enthaelt sie KEINEN Tier Type-Export, KEIN VALID_TIERS Constant-Export,
   *            KEIN UpdateModelSettingInput Interface
   *       AND GenerationMode, VALID_GENERATION_MODES bleiben unveraendert erhalten
   */
  it('should not export Tier type', () => {
    const content = readFileSync(resolve(ROOT, 'lib/types.ts'), 'utf-8')
    // Must not contain a Tier type export (but allow "SlotNumber", "GenerationMode" etc.)
    expect(content).not.toMatch(/export\s+type\s+Tier\b/)
  })

  it('should not export VALID_TIERS constant', () => {
    const content = readFileSync(resolve(ROOT, 'lib/types.ts'), 'utf-8')
    expect(content).not.toMatch(/VALID_TIERS/)
  })

  it('should not export UpdateModelSettingInput interface', () => {
    const content = readFileSync(resolve(ROOT, 'lib/types.ts'), 'utf-8')
    expect(content).not.toMatch(/UpdateModelSettingInput/)
  })

  it('should still export GenerationMode type', () => {
    const content = readFileSync(resolve(ROOT, 'lib/types.ts'), 'utf-8')
    expect(content).toMatch(/export\s+type\s+GenerationMode/)
  })

  it('should still export VALID_GENERATION_MODES constant', () => {
    const content = readFileSync(resolve(ROOT, 'lib/types.ts'), 'utf-8')
    expect(content).toMatch(/VALID_GENERATION_MODES/)
  })
})

// ===========================================================================
// AC-3: Popover interfaces cleaned up
// ===========================================================================
describe('AC-3: Popover interfaces cleaned of legacy props', () => {
  /**
   * AC-3: GIVEN die Popover-Interfaces in variation-popover.tsx,
   *       img2img-popover.tsx, upscale-popover.tsx
   *       WHEN die Dateien inspiziert werden
   *       THEN enthaelt KEINES der Params-Interfaces ein tier? Feld
   *       AND KEINES der Props-Interfaces ein modelSettings? Feld
   *       AND modelSlots und models Props sind Pflicht-Felder (nicht mehr optional)
   *       AND der Legacy-Pfad-Code (TierToggle-Rendering bei fehlenden modelSlots)
   *           ist vollstaendig entfernt
   */
  const popoverFiles = [
    'components/canvas/popovers/variation-popover.tsx',
    'components/canvas/popovers/img2img-popover.tsx',
    'components/canvas/popovers/upscale-popover.tsx',
  ]

  for (const file of popoverFiles) {
    const shortName = file.split('/').pop()!

    it(`${shortName}: should not contain tier? field in any interface`, () => {
      const content = readFileSync(resolve(ROOT, file), 'utf-8')
      // Match "tier?" or "tier ?" as optional field in an interface
      expect(content).not.toMatch(/\btier\s*\?/)
    })

    it(`${shortName}: should not contain modelSettings? field in any interface`, () => {
      const content = readFileSync(resolve(ROOT, file), 'utf-8')
      expect(content).not.toMatch(/\bmodelSettings\s*\?/)
    })

    it(`${shortName}: should have modelSlots as required prop (not optional)`, () => {
      const content = readFileSync(resolve(ROOT, file), 'utf-8')
      // modelSlots must be present but NOT as optional (no "modelSlots?")
      expect(content).toMatch(/\bmodelSlots\b/)
      expect(content).not.toMatch(/\bmodelSlots\s*\?/)
    })

    it(`${shortName}: should have models as required prop (not optional)`, () => {
      const content = readFileSync(resolve(ROOT, file), 'utf-8')
      // models must be present but NOT as optional (no "models?")
      // Be careful: "models" appears in many contexts. We check Props interface area.
      expect(content).toMatch(/\bmodels\b/)
      expect(content).not.toMatch(/\bmodels\s*\?\s*:/)
    })

    it(`${shortName}: should not import TierToggle`, () => {
      const content = readFileSync(resolve(ROOT, file), 'utf-8')
      expect(content).not.toMatch(/TierToggle/)
    })

    it(`${shortName}: should not contain legacy Tier type import`, () => {
      const content = readFileSync(resolve(ROOT, file), 'utf-8')
      // Should not import Tier from types or have Tier type references
      expect(content).not.toMatch(/import.*\bTier\b.*from/)
      expect(content).not.toMatch(/\bTier\b\s*[;,}]/) // Tier as imported identifier
    })

    it(`${shortName}: should not contain legacy fallback code with TierToggle`, () => {
      const content = readFileSync(resolve(ROOT, file), 'utf-8')
      expect(content).not.toContain('TierToggle')
      expect(content).not.toContain('tier-toggle')
    })
  }
})

// ===========================================================================
// AC-4: No legacy references in codebase (grep check)
// ===========================================================================
describe('AC-4: Zero legacy identifier matches in ts/tsx files', () => {
  /**
   * AC-4: GIVEN alle .ts und .tsx Dateien im Repo (exkl. node_modules, specs/, drizzle/)
   *       WHEN grep -r "TierToggle|tier-toggle|model-settings-service|VALID_TIERS|
   *            model-settings-changed" ausgefuehrt wird
   *       THEN liefert der Befehl 0 Treffer
   */
  const legacyPatterns = [
    'TierToggle',
    'tier-toggle',
    'model-settings-service',
    'VALID_TIERS',
    'model-settings-changed',
  ]

  it('should find zero matches for legacy identifiers across all ts/tsx files', () => {
    const allFiles = collectTsTsxFiles(ROOT)
    const matches: { file: string; pattern: string; line: string }[] = []

    for (const filePath of allFiles) {
      // Skip test files in tests/acceptance to avoid self-referencing
      if (filePath.includes('tests/acceptance/test_slice_15')) continue

      let content: string
      try {
        content = readFileSync(filePath, 'utf-8')
      } catch {
        continue
      }

      const lines = content.split('\n')
      for (const pattern of legacyPatterns) {
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(pattern)) {
            matches.push({
              file: filePath.replace(ROOT + '/', ''),
              pattern,
              line: `L${i + 1}: ${lines[i].trim()}`,
            })
          }
        }
      }
    }

    expect(
      matches,
      `Found ${matches.length} legacy references:\n${matches.map((m) => `  ${m.file} [${m.pattern}] ${m.line}`).join('\n')}`
    ).toHaveLength(0)
  })
})

// ===========================================================================
// AC-5: No imports from deleted model-settings modules
// ===========================================================================
describe('AC-5: Zero imports from model-settings modules', () => {
  /**
   * AC-5: GIVEN alle .ts und .tsx Dateien im Repo (exkl. node_modules, specs/, drizzle/)
   *       WHEN grep -r "import.*model-settings|from.*model-settings" ausgefuehrt wird
   *       THEN liefert der Befehl 0 Treffer (kein Import aus geloeschten Modulen)
   */
  it('should find zero imports from model-settings in ts/tsx files', () => {
    const allFiles = collectTsTsxFiles(ROOT)
    const matches: { file: string; line: string }[] = []

    for (const filePath of allFiles) {
      // Skip this test file itself
      if (filePath.includes('tests/acceptance/test_slice_15')) continue

      let content: string
      try {
        content = readFileSync(filePath, 'utf-8')
      } catch {
        continue
      }

      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Check for import statements referencing model-settings
        if (
          (line.match(/import.*model-settings/) ||
            line.match(/from\s+['"].*model-settings/)) &&
          // Exclude comments
          !line.trimStart().startsWith('//')
        ) {
          matches.push({
            file: filePath.replace(ROOT + '/', ''),
            line: `L${i + 1}: ${line.trim()}`,
          })
        }
      }
    }

    expect(
      matches,
      `Found ${matches.length} model-settings imports:\n${matches.map((m) => `  ${m.file} ${m.line}`).join('\n')}`
    ).toHaveLength(0)
  })
})

// ===========================================================================
// AC-6: TypeScript compiles without errors
// ===========================================================================
describe('AC-6: TypeScript compilation', () => {
  /**
   * AC-6: GIVEN der gesamte TypeScript-Codebase
   *       WHEN pnpm tsc --noEmit ausgefuehrt wird
   *       THEN kompiliert der Codebase fehlerfrei (Exit-Code 0)
   */
  it('should pass tsc --noEmit without errors', () => {
    let result: string
    try {
      result = execSync('pnpm tsc --noEmit', {
        cwd: ROOT,
        encoding: 'utf-8',
        timeout: 120_000,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    } catch (error: any) {
      // If tsc fails, the error output contains the diagnostics
      const stderr = error.stderr || ''
      const stdout = error.stdout || ''
      throw new Error(
        `tsc --noEmit failed with exit code ${error.status}.\n` +
          `stdout:\n${stdout}\nstderr:\n${stderr}`
      )
    }
    // If we get here, tsc exited with 0
    expect(true).toBe(true)
  })
})

// ===========================================================================
// AC-7: Orphaned test files deleted
// ===========================================================================
describe('AC-7: Orphaned test files deleted', () => {
  /**
   * AC-7: GIVEN verwaiste Test-Dateien die geloeschte Module testen
   *       WHEN Slice 15 abgeschlossen ist
   *       THEN sind folgende Test-Dateien geloescht:
   *            - components/ui/__tests__/tier-toggle.test.tsx
   *            - components/ui/__tests__/max-quality-toggle.test.tsx
   *            - lib/services/__tests__/model-settings-service.test.ts
   *            - app/actions/__tests__/model-settings.test.ts
   *            - __tests__/slice-09/model-settings-auth.test.ts
   *       AND verbleibende Test-Dateien die Legacy-Referenzen enthielten
   *           (z.B. canvas-chat-panel-tier-toggle.test.tsx,
   *            prompt-area-tier-toggle.test.tsx) sind ebenfalls geloescht
   *            oder bereinigt
   */
  const orphanedTestFiles = [
    'components/ui/__tests__/tier-toggle.test.tsx',
    'components/ui/__tests__/max-quality-toggle.test.tsx',
    'lib/services/__tests__/model-settings-service.test.ts',
    'app/actions/__tests__/model-settings.test.ts',
    '__tests__/slice-09/model-settings-auth.test.ts',
  ]

  for (const file of orphanedTestFiles) {
    it(`should confirm ${file} is deleted`, () => {
      expect(existsSync(resolve(ROOT, file))).toBe(false)
    })
  }

  // Legacy-referencing test files should also be gone or cleaned
  const legacyTestFiles = [
    'components/workspace/__tests__/canvas-chat-panel-tier-toggle.test.tsx',
    'components/workspace/__tests__/prompt-area-tier-toggle.test.tsx',
  ]

  for (const file of legacyTestFiles) {
    it(`should confirm legacy test ${file} is deleted or cleaned`, () => {
      const filePath = resolve(ROOT, file)
      if (existsSync(filePath)) {
        // If file still exists, it must not contain TierToggle references
        const content = readFileSync(filePath, 'utf-8')
        expect(content).not.toContain('TierToggle')
        expect(content).not.toContain('tier-toggle')
        expect(content).not.toContain('model-settings-service')
      }
      // If file does not exist, that is also acceptable (deleted)
    })
  }
})

// ===========================================================================
// AC-8: settings-dialog.tsx uses only model-slots-changed events
// ===========================================================================
describe('AC-8: settings-dialog uses model-slots-changed events only', () => {
  /**
   * AC-8: GIVEN components/settings/settings-dialog.tsx
   *       WHEN die Datei inspiziert wird
   *       THEN referenziert sie NUR "model-slots-changed" Events
   *            (kein "model-settings-changed")
   */
  it('should not contain model-settings-changed event references', () => {
    const filePath = resolve(ROOT, 'components/settings/settings-dialog.tsx')
    expect(existsSync(filePath)).toBe(true)

    const content = readFileSync(filePath, 'utf-8')
    expect(content).not.toContain('model-settings-changed')
  })

  it('should contain model-slots-changed event reference', () => {
    const filePath = resolve(ROOT, 'components/settings/settings-dialog.tsx')
    const content = readFileSync(filePath, 'utf-8')
    expect(content).toContain('model-slots-changed')
  })
})
