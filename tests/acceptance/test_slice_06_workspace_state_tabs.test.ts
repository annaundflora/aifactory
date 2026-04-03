import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { execSync } from 'child_process'

/**
 * Acceptance tests for Slice 06: Workspace State & Prompt Tabs/Lists UI
 *
 * Verifies that promptStyle and negativePrompt have been completely removed
 * from WorkspaceVariationState, PromptTabsProps, HistoryListProps, and
 * FavoritesListProps -- and that hasAnyPromptContent checks only promptMotiv.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROOT = resolve(__dirname, '..', '..')

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf-8')
}

function extractInterface(source: string, interfaceName: string): string {
  const re = new RegExp(
    `(?:export\\s+)?interface\\s+${interfaceName}\\s*\\{([^}]+)\\}`,
    's'
  )
  const match = source.match(re)
  if (!match) throw new Error(`Interface ${interfaceName} not found in source`)
  return match[1]
}

// ---------------------------------------------------------------------------
// AC-1: WorkspaceVariationState
// ---------------------------------------------------------------------------

describe('Slice-06 Acceptance: WorkspaceVariationState', () => {
  const source = readSource('lib/workspace-state.tsx')
  const body = extractInterface(source, 'WorkspaceVariationState')

  it('AC-1: should not include promptStyle in WorkspaceVariationState', () => {
    /**
     * AC-1: GIVEN das Interface WorkspaceVariationState in workspace-state.tsx
     *       WHEN der TypeScript-Compiler das Interface prueft
     *       THEN existiert KEINE Property promptStyle
     */
    expect(body).not.toMatch(/promptStyle/)
  })

  it('AC-1: should not include negativePrompt in WorkspaceVariationState', () => {
    /**
     * AC-1: GIVEN das Interface WorkspaceVariationState in workspace-state.tsx
     *       WHEN der TypeScript-Compiler das Interface prueft
     *       THEN existiert KEINE Property negativePrompt
     */
    expect(body).not.toMatch(/negativePrompt/)
  })

  it('AC-1: should retain promptMotiv, modelId, modelParams and optional fields unchanged', () => {
    /**
     * AC-1: GIVEN das Interface WorkspaceVariationState in workspace-state.tsx
     *       WHEN der TypeScript-Compiler das Interface prueft
     *       THEN sind promptMotiv, modelId, modelParams, targetMode?, sourceImageUrl?,
     *            strength?, sourceGenerationId?, addReference? UNVERAENDERT vorhanden
     */
    expect(body).toMatch(/promptMotiv/)
    expect(body).toMatch(/modelId/)
    expect(body).toMatch(/modelParams/)
    expect(body).toMatch(/targetMode\?/)
    expect(body).toMatch(/sourceImageUrl\?/)
    expect(body).toMatch(/strength\?/)
    expect(body).toMatch(/sourceGenerationId\?/)
    expect(body).toMatch(/addReference\?/)
  })
})

// ---------------------------------------------------------------------------
// AC-2: PromptTabsProps
// ---------------------------------------------------------------------------

describe('Slice-06 Acceptance: PromptTabsProps', () => {
  const source = readSource('components/workspace/prompt-tabs.tsx')
  const body = extractInterface(source, 'PromptTabsProps')

  it('AC-2: should not include promptStyle or negativePrompt in PromptTabsProps', () => {
    /**
     * AC-2: GIVEN das Interface PromptTabsProps in prompt-tabs.tsx
     *       WHEN der TypeScript-Compiler die Props prueft
     *       THEN existiert KEINE Property promptStyle und KEINE Property negativePrompt
     *       AND die Property promptMotiv? ist weiterhin vorhanden
     */
    expect(body).not.toMatch(/promptStyle/)
    expect(body).not.toMatch(/negativePrompt/)
    expect(body).toMatch(/promptMotiv\?/)
  })

  it('AC-2: should not forward promptStyle or negativePrompt to HistoryList or FavoritesList', () => {
    /**
     * AC-2: GIVEN die Weitergabe von Props in prompt-tabs.tsx
     *       WHEN die JSX-Nutzung von HistoryList und FavoritesList geprueft wird
     *       THEN wird promptStyle/negativePrompt NICHT weitergegeben
     */
    // Check HistoryList JSX usage
    const historyJsx = source.match(/<HistoryList[\s\S]*?\/>/g)
    expect(historyJsx).not.toBeNull()
    for (const jsx of historyJsx!) {
      expect(jsx).not.toMatch(/promptStyle/)
      expect(jsx).not.toMatch(/negativePrompt/)
    }

    // Check FavoritesList JSX usage
    const favoritesJsx = source.match(/<FavoritesList[\s\S]*?\/>/g)
    expect(favoritesJsx).not.toBeNull()
    for (const jsx of favoritesJsx!) {
      expect(jsx).not.toMatch(/promptStyle/)
      expect(jsx).not.toMatch(/negativePrompt/)
    }
  })
})

// ---------------------------------------------------------------------------
// AC-3: HistoryListProps
// ---------------------------------------------------------------------------

describe('Slice-06 Acceptance: HistoryListProps', () => {
  const source = readSource('components/workspace/history-list.tsx')
  const body = extractInterface(source, 'HistoryListProps')

  it('AC-3: should not include promptStyle or negativePrompt in HistoryListProps', () => {
    /**
     * AC-3: GIVEN das Interface HistoryListProps in history-list.tsx
     *       WHEN der TypeScript-Compiler die Props prueft
     *       THEN existiert KEINE Property promptStyle und KEINE Property negativePrompt
     *       AND die Property promptMotiv? ist weiterhin vorhanden
     */
    expect(body).not.toMatch(/promptStyle/)
    expect(body).not.toMatch(/negativePrompt/)
    expect(body).toMatch(/promptMotiv\?/)
  })
})

// ---------------------------------------------------------------------------
// AC-4: hasAnyPromptContent in history-list.tsx
// ---------------------------------------------------------------------------

describe('Slice-06 Acceptance: hasAnyPromptContent in HistoryList', () => {
  const source = readSource('components/workspace/history-list.tsx')

  it('AC-4: hasAnyPromptContent should check only promptMotiv and not reference removed fields', () => {
    /**
     * AC-4: GIVEN die Funktion hasAnyPromptContent in history-list.tsx
     *       WHEN die Funktion inspiziert wird
     *       THEN referenziert sie WEDER promptStyle noch negativePrompt
     *       AND sie prueft promptMotiv.trim() !== ""
     */
    const fnMatch = source.match(
      /const\s+hasAnyPromptContent\s*=\s*useCallback\s*\(\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*,/
    )
    expect(fnMatch).not.toBeNull()
    const fnBody = fnMatch![1]

    expect(fnBody).not.toMatch(/promptStyle/)
    expect(fnBody).not.toMatch(/negativePrompt/)
    expect(fnBody).toMatch(/promptMotiv/)
  })
})

// ---------------------------------------------------------------------------
// AC-5: FavoritesListProps & hasAnyPromptContent in favorites-list.tsx
// ---------------------------------------------------------------------------

describe('Slice-06 Acceptance: FavoritesListProps', () => {
  const source = readSource('components/workspace/favorites-list.tsx')
  const body = extractInterface(source, 'FavoritesListProps')

  it('AC-5: should not include promptStyle or negativePrompt in FavoritesListProps', () => {
    /**
     * AC-5: GIVEN das Interface FavoritesListProps in favorites-list.tsx
     *       WHEN der TypeScript-Compiler die Props prueft
     *       THEN existiert KEINE Property promptStyle und KEINE Property negativePrompt
     */
    expect(body).not.toMatch(/promptStyle/)
    expect(body).not.toMatch(/negativePrompt/)
  })

  it('AC-5: hasAnyPromptContent should check only promptMotiv.trim() !== ""', () => {
    /**
     * AC-5: GIVEN die hasAnyPromptContent-Funktion in favorites-list.tsx
     *       WHEN die Funktion inspiziert wird
     *       THEN prueft sie NUR promptMotiv.trim() !== ""
     */
    const fnMatch = source.match(
      /const\s+hasAnyPromptContent\s*=\s*useCallback\s*\(\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*,/
    )
    expect(fnMatch).not.toBeNull()
    const fnBody = fnMatch![1]

    expect(fnBody).not.toMatch(/promptStyle/)
    expect(fnBody).not.toMatch(/negativePrompt/)
    expect(fnBody).toMatch(/promptMotiv\.trim\(\)\s*!==\s*""/)
  })
})

// ---------------------------------------------------------------------------
// AC-6: TypeScript Compiler passes with 0 errors
// ---------------------------------------------------------------------------

describe('Slice-06 Acceptance: TypeScript Compiler', () => {
  it('AC-6: npx tsc --noEmit should report 0 errors for affected files', () => {
    /**
     * AC-6: GIVEN alle Aenderungen aus AC-1 bis AC-5
     *       WHEN npx tsc --noEmit ausgefuehrt wird
     *       THEN meldet der TypeScript-Compiler 0 Fehler in workspace-state.tsx,
     *            prompt-tabs.tsx, history-list.tsx und favorites-list.tsx
     */
    const filesToCheck = [
      'lib/workspace-state.tsx',
      'components/workspace/prompt-tabs.tsx',
      'components/workspace/history-list.tsx',
      'components/workspace/favorites-list.tsx',
    ]

    // Run tsc --noEmit on the project root
    // If there are TS errors, execSync will throw with the stderr output
    let tscOutput = ''
    let tscExitCode = 0
    try {
      tscOutput = execSync('npx tsc --noEmit 2>&1', {
        cwd: ROOT,
        encoding: 'utf-8',
        timeout: 60_000,
      })
    } catch (err: unknown) {
      const execError = err as { stdout?: string; stderr?: string; status?: number }
      tscOutput = (execError.stdout ?? '') + (execError.stderr ?? '')
      tscExitCode = execError.status ?? 1
    }

    // Filter tsc output lines to only those referencing our affected files
    const relevantErrors = tscOutput
      .split('\n')
      .filter((line) =>
        filesToCheck.some((file) => line.includes(file))
      )

    expect(relevantErrors).toEqual([])

    // If there were relevant errors, fail with context
    if (relevantErrors.length > 0) {
      throw new Error(
        `TypeScript errors in affected files:\n${relevantErrors.join('\n')}`
      )
    }
  })
})
