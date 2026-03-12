import { describe, it, expect, vi } from 'vitest'

/**
 * Unit tests for slice-07-legacy-cleanup: prompts.ts export verification
 *
 * These tests verify that after the legacy cleanup, the prompts.ts server
 * action module only exports the four retained functions and no snippet-related
 * functions remain.
 */

// Mock dependencies to prevent DATABASE_URL crash
vi.mock('@/lib/db/queries', () => ({}))
vi.mock('@/lib/services/prompt-service', () => ({
  PromptService: { improve: vi.fn() },
}))
vi.mock('@/lib/services/prompt-history-service', () => ({
  promptHistoryService: {
    getHistory: vi.fn(),
    getFavorites: vi.fn(),
    toggleFavorite: vi.fn(),
  },
}))

import * as promptsModule from '@/app/actions/prompts'

describe('prompts.ts exports after legacy cleanup', () => {
  /**
   * AC-5: Verifies that prompts.ts only exports the four retained functions.
   */
  it('AC-5: should export exactly getPromptHistory, getFavoritePrompts, toggleFavorite, improvePrompt', () => {
    const exportedKeys = Object.keys(promptsModule).sort()

    expect(exportedKeys).toEqual([
      'getFavoritePrompts',
      'getPromptHistory',
      'improvePrompt',
      'toggleFavorite',
    ])
  })

  it('AC-5: should NOT export any snippet-related functions', () => {
    const exportedKeys = Object.keys(promptsModule)

    expect(exportedKeys).not.toContain('createSnippet')
    expect(exportedKeys).not.toContain('updateSnippet')
    expect(exportedKeys).not.toContain('deleteSnippet')
    expect(exportedKeys).not.toContain('getSnippets')
    expect(exportedKeys).not.toContain('validateSnippetInput')
  })

  it('AC-5: all exported values should be functions', () => {
    expect(typeof promptsModule.getPromptHistory).toBe('function')
    expect(typeof promptsModule.getFavoritePrompts).toBe('function')
    expect(typeof promptsModule.toggleFavorite).toBe('function')
    expect(typeof promptsModule.improvePrompt).toBe('function')
  })
})
