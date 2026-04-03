// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Unit tests for FavoritesList prompt field removal (slice-06).
 *
 * These tests verify that promptStyle and negativePrompt have been removed
 * from FavoritesListProps and that hasAnyPromptContent checks only promptMotiv.
 */

// ---------------------------------------------------------------------------
// Polyfills for jsdom (Radix UI needs ResizeObserver + pointer events)
// ---------------------------------------------------------------------------

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }

  if (typeof Element.prototype.hasPointerCapture === 'undefined') {
    Element.prototype.hasPointerCapture = () => false
    Element.prototype.setPointerCapture = () => {}
    Element.prototype.releasePointerCapture = () => {}
  }

  if (typeof Element.prototype.scrollIntoView === 'undefined') {
    Element.prototype.scrollIntoView = () => {}
  }
})

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/db/queries', () => ({}))

const mockGetFavoritePrompts = vi.fn()
const mockToggleFavorite = vi.fn()
vi.mock('@/app/actions/prompts', () => ({
  getFavoritePrompts: (...args: unknown[]) => mockGetFavoritePrompts(...args),
  toggleFavorite: (...args: unknown[]) => mockToggleFavorite(...args),
}))

vi.mock('lucide-react', () => ({
  Star: ({ fill, ...props }: Record<string, unknown>) => (
    <svg data-testid="star-icon" data-fill={fill} {...props} />
  ),
}))

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

import { FavoritesList } from '@/components/workspace/favorites-list'
import type { PromptHistoryEntry } from '@/lib/services/prompt-history-service'

// ---------------------------------------------------------------------------
// Test Data Factory
// ---------------------------------------------------------------------------

function makeEntry(
  overrides: Partial<PromptHistoryEntry> = {}
): PromptHistoryEntry {
  return {
    generationId: overrides.generationId ?? crypto.randomUUID(),
    promptMotiv: overrides.promptMotiv ?? 'A test prompt',
    modelId: overrides.modelId ?? 'vendor/model-test',
    modelParams: overrides.modelParams ?? {},
    isFavorite: overrides.isFavorite ?? true,
    createdAt: overrides.createdAt ?? new Date(),
  }
}

// ---------------------------------------------------------------------------
// Tests: FavoritesList - prompt field removal (Slice 06)
// ---------------------------------------------------------------------------

describe('FavoritesList - prompt field removal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetFavoritePrompts.mockResolvedValue([])
    mockToggleFavorite.mockResolvedValue({ isFavorite: false })
  })

  // --------------------------------------------------------------------------
  // AC-5: Props Interface hat kein promptStyle/negativePrompt
  // --------------------------------------------------------------------------
  it('should not accept promptStyle or negativePrompt props', () => {
    /**
     * AC-5: GIVEN das Interface FavoritesListProps in favorites-list.tsx
     *       WHEN der TypeScript-Compiler die Props prueft
     *       THEN existiert KEINE Property promptStyle und KEINE Property negativePrompt
     */
    const sourcePath = path.resolve(
      __dirname,
      '..',
      'favorites-list.tsx'
    )
    const source = fs.readFileSync(sourcePath, 'utf-8')

    // Extract the FavoritesListProps interface body
    const interfaceMatch = source.match(
      /interface\s+FavoritesListProps\s*\{([^}]+)\}/s
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
  // AC-5: hasAnyPromptContent checks only promptMotiv
  // --------------------------------------------------------------------------
  it('should check only promptMotiv in hasAnyPromptContent', () => {
    /**
     * AC-5: GIVEN das Interface FavoritesListProps in favorites-list.tsx
     *       WHEN die hasAnyPromptContent-Funktion geprueft wird
     *       THEN prueft sie NUR promptMotiv.trim() !== ""
     */
    const sourcePath = path.resolve(
      __dirname,
      '..',
      'favorites-list.tsx'
    )
    const source = fs.readFileSync(sourcePath, 'utf-8')

    // Extract the hasAnyPromptContent function body
    const fnMatch = source.match(
      /const\s+hasAnyPromptContent\s*=\s*useCallback\s*\(\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*,/
    )
    expect(fnMatch).not.toBeNull()
    const fnBody = fnMatch![1]

    // Must NOT reference promptStyle or negativePrompt
    expect(fnBody).not.toMatch(/promptStyle/)
    expect(fnBody).not.toMatch(/negativePrompt/)

    // Must reference only promptMotiv with trim check
    expect(fnBody).toMatch(/promptMotiv\.trim\(\)\s*!==\s*""/)
  })

  // --------------------------------------------------------------------------
  // AC-5: hasAnyPromptContent behavioral test -- whitespace returns false
  // --------------------------------------------------------------------------
  it('should not trigger confirmation dialog when promptMotiv is whitespace-only', async () => {
    /**
     * AC-5: Behavioral verification that hasAnyPromptContent returns false
     *       for whitespace-only promptMotiv (consistent with AC-4 in history-list)
     */
    const user = userEvent.setup()
    const entry = makeEntry({ promptMotiv: 'Test prompt to click' })
    mockGetFavoritePrompts.mockResolvedValue([entry])

    const onLoadEntry = vi.fn()
    render(
      <FavoritesList
        onLoadEntry={onLoadEntry}
        promptMotiv="   "
      />
    )

    await waitFor(() => {
      expect(mockGetFavoritePrompts).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })

    // Click the entry -- whitespace-only means no content, should call directly
    const entryElement = screen.getByTestId('favorites-entry')
    await user.click(entryElement)

    // Should NOT show confirmation dialog
    expect(screen.queryByText('Replace current prompt?')).not.toBeInTheDocument()

    // Should call onLoadEntry directly
    expect(onLoadEntry).toHaveBeenCalledWith(entry)
  })

  // --------------------------------------------------------------------------
  // AC-5: hasAnyPromptContent behavioral test -- content returns true
  // --------------------------------------------------------------------------
  it('should trigger confirmation dialog when promptMotiv has content', async () => {
    /**
     * AC-5: Behavioral verification that hasAnyPromptContent returns true
     *       for non-empty promptMotiv
     */
    const user = userEvent.setup()
    const entry = makeEntry({ promptMotiv: 'Test prompt to click' })
    mockGetFavoritePrompts.mockResolvedValue([entry])

    const onLoadEntry = vi.fn()
    render(
      <FavoritesList
        onLoadEntry={onLoadEntry}
        promptMotiv="a cat"
      />
    )

    await waitFor(() => {
      expect(mockGetFavoritePrompts).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })

    // Click the entry -- "a cat" has content, should trigger dialog
    const entryElement = screen.getByTestId('favorites-entry')
    await user.click(entryElement)

    // Should show confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('Replace current prompt?')).toBeInTheDocument()
    })

    // onLoadEntry should NOT have been called yet
    expect(onLoadEntry).not.toHaveBeenCalled()
  })
})
