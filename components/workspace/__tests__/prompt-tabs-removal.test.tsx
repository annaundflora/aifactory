// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Unit tests for PromptTabs prompt field removal (slice-06).
 *
 * These tests verify that promptStyle and negativePrompt have been removed
 * from the PromptTabsProps interface and that they are no longer forwarded
 * to HistoryList or FavoritesList child components.
 */

describe('PromptTabs - prompt field removal', () => {
  // --------------------------------------------------------------------------
  // AC-2: Props Interface hat kein promptStyle/negativePrompt
  // --------------------------------------------------------------------------
  it('should not accept promptStyle or negativePrompt props', () => {
    /**
     * AC-2: GIVEN das Interface PromptTabsProps in prompt-tabs.tsx
     *       WHEN der TypeScript-Compiler die Props prueft
     *       THEN existiert KEINE Property promptStyle und KEINE Property negativePrompt
     *       AND die Property promptMotiv? ist weiterhin vorhanden
     */
    const sourcePath = path.resolve(
      __dirname,
      '..',
      'prompt-tabs.tsx'
    )
    const source = fs.readFileSync(sourcePath, 'utf-8')

    // Extract the PromptTabsProps interface body
    const interfaceMatch = source.match(
      /interface\s+PromptTabsProps\s*\{([^}]+)\}/s
    )
    expect(interfaceMatch).not.toBeNull()
    const interfaceBody = interfaceMatch![1]

    // Must NOT contain promptStyle or negativePrompt
    expect(interfaceBody).not.toMatch(/promptStyle/)
    expect(interfaceBody).not.toMatch(/negativePrompt/)

    // Must still contain promptMotiv
    expect(interfaceBody).toMatch(/promptMotiv\?/)
  })

  // --------------------------------------------------------------------------
  // AC-2: Keine Weitergabe an HistoryList
  // --------------------------------------------------------------------------
  it('should not forward promptStyle or negativePrompt to HistoryList', () => {
    /**
     * AC-2: GIVEN das Interface PromptTabsProps in prompt-tabs.tsx
     *       WHEN der TypeScript-Compiler die Props prueft
     *       THEN existiert KEINE Weitergabe von promptStyle/negativePrompt an HistoryList
     */
    const sourcePath = path.resolve(
      __dirname,
      '..',
      'prompt-tabs.tsx'
    )
    const source = fs.readFileSync(sourcePath, 'utf-8')

    // Find all <HistoryList ... /> JSX usages and check their props
    const historyListJsx = source.match(/<HistoryList[\s\S]*?\/>/g)
    expect(historyListJsx).not.toBeNull()

    for (const jsx of historyListJsx!) {
      expect(jsx).not.toMatch(/promptStyle/)
      expect(jsx).not.toMatch(/negativePrompt/)
    }

    // HistoryList should still receive promptMotiv
    const hasPromptMotivForwarding = historyListJsx!.some((jsx) =>
      jsx.includes('promptMotiv')
    )
    expect(hasPromptMotivForwarding).toBe(true)
  })

  // --------------------------------------------------------------------------
  // AC-2: Keine Weitergabe an FavoritesList
  // --------------------------------------------------------------------------
  it('should not forward promptStyle or negativePrompt to FavoritesList', () => {
    /**
     * AC-2: GIVEN das Interface PromptTabsProps in prompt-tabs.tsx
     *       WHEN der TypeScript-Compiler die Props prueft
     *       THEN existiert KEINE Weitergabe von promptStyle/negativePrompt an FavoritesList
     */
    const sourcePath = path.resolve(
      __dirname,
      '..',
      'prompt-tabs.tsx'
    )
    const source = fs.readFileSync(sourcePath, 'utf-8')

    // Find all <FavoritesList ... /> JSX usages and check their props
    const favoritesListJsx = source.match(/<FavoritesList[\s\S]*?\/>/g)
    expect(favoritesListJsx).not.toBeNull()

    for (const jsx of favoritesListJsx!) {
      expect(jsx).not.toMatch(/promptStyle/)
      expect(jsx).not.toMatch(/negativePrompt/)
    }

    // FavoritesList should still receive promptMotiv
    const hasPromptMotivForwarding = favoritesListJsx!.some((jsx) =>
      jsx.includes('promptMotiv')
    )
    expect(hasPromptMotivForwarding).toBe(true)
  })
})
