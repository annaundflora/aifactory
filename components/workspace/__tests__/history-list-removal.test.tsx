// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Unit tests for HistoryList prompt field removal (slice-06).
 *
 * These tests verify that promptStyle and negativePrompt have been removed
 * from HistoryListProps and that hasAnyPromptContent checks only promptMotiv.
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

const mockGetPromptHistory = vi.fn()
const mockToggleFavorite = vi.fn()
vi.mock('@/app/actions/prompts', () => ({
  getPromptHistory: (...args: unknown[]) => mockGetPromptHistory(...args),
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

import { HistoryList } from '@/components/workspace/history-list'
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
    isFavorite: overrides.isFavorite ?? false,
    createdAt: overrides.createdAt ?? new Date(),
  }
}

// ---------------------------------------------------------------------------
// Tests: HistoryList - prompt field removal (Slice 06)
// ---------------------------------------------------------------------------

describe('HistoryList - prompt field removal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPromptHistory.mockResolvedValue([])
    mockToggleFavorite.mockResolvedValue({ isFavorite: true })
  })

  // --------------------------------------------------------------------------
  // AC-3: Props Interface hat kein promptStyle/negativePrompt
  // --------------------------------------------------------------------------
  it('should not accept promptStyle or negativePrompt props', () => {
    /**
     * AC-3: GIVEN das Interface HistoryListProps in history-list.tsx
     *       WHEN der TypeScript-Compiler die Props prueft
     *       THEN existiert KEINE Property promptStyle und KEINE Property negativePrompt
     *       AND die Property promptMotiv? ist weiterhin vorhanden
     */
    const sourcePath = path.resolve(
      __dirname,
      '..',
      'history-list.tsx'
    )
    const source = fs.readFileSync(sourcePath, 'utf-8')

    // Extract the HistoryListProps interface body
    const interfaceMatch = source.match(
      /interface\s+HistoryListProps\s*\{([^}]+)\}/s
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
  // AC-4: hasAnyPromptContent returns false for whitespace-only promptMotiv
  // --------------------------------------------------------------------------
  it('should return false for hasAnyPromptContent when promptMotiv is whitespace-only', async () => {
    /**
     * AC-4: GIVEN die Funktion hasAnyPromptContent in history-list.tsx
     *       WHEN promptMotiv den Wert "  " (nur Whitespace) hat
     *       THEN gibt hasAnyPromptContent() den Wert false zurueck
     */
    const user = userEvent.setup()
    const entry = makeEntry({ promptMotiv: 'Test prompt to click' })
    mockGetPromptHistory.mockResolvedValue([entry])

    const onLoadEntry = vi.fn()
    render(
      <HistoryList
        onLoadEntry={onLoadEntry}
        promptMotiv="  "
      />
    )

    await waitFor(() => {
      expect(mockGetPromptHistory).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })

    // Click the entry -- whitespace-only promptMotiv means hasAnyPromptContent returns false,
    // so onLoadEntry should be called directly without dialog
    const entryElement = screen.getByTestId('history-entry')
    await user.click(entryElement)

    // Should NOT show confirmation dialog (whitespace = no content)
    expect(screen.queryByText('Replace current prompt?')).not.toBeInTheDocument()

    // Should call onLoadEntry directly
    expect(onLoadEntry).toHaveBeenCalledWith(entry)
  })

  // --------------------------------------------------------------------------
  // AC-4: hasAnyPromptContent returns true for non-empty promptMotiv
  // --------------------------------------------------------------------------
  it('should return true for hasAnyPromptContent when promptMotiv has content', async () => {
    /**
     * AC-4: GIVEN die Funktion hasAnyPromptContent in history-list.tsx
     *       WHEN promptMotiv den Wert "a cat" hat
     *       THEN gibt hasAnyPromptContent() den Wert true zurueck
     */
    const user = userEvent.setup()
    const entry = makeEntry({ promptMotiv: 'Test prompt to click' })
    mockGetPromptHistory.mockResolvedValue([entry])

    const onLoadEntry = vi.fn()
    render(
      <HistoryList
        onLoadEntry={onLoadEntry}
        promptMotiv="a cat"
      />
    )

    await waitFor(() => {
      expect(mockGetPromptHistory).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })

    // Click the entry -- "a cat" is non-empty, so hasAnyPromptContent returns true
    // and the confirmation dialog should appear
    const entryElement = screen.getByTestId('history-entry')
    await user.click(entryElement)

    // Should show confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('Replace current prompt?')).toBeInTheDocument()
    })

    // onLoadEntry should NOT have been called yet (pending dialog)
    expect(onLoadEntry).not.toHaveBeenCalled()
  })

  // --------------------------------------------------------------------------
  // AC-4: hasAnyPromptContent does not reference promptStyle/negativePrompt
  // --------------------------------------------------------------------------
  it('should not reference promptStyle or negativePrompt in hasAnyPromptContent', () => {
    /**
     * AC-4: GIVEN die Funktion hasAnyPromptContent in history-list.tsx
     *       WHEN die Funktion inspiziert wird
     *       THEN referenziert sie WEDER promptStyle noch negativePrompt
     */
    const sourcePath = path.resolve(
      __dirname,
      '..',
      'history-list.tsx'
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

    // Must reference promptMotiv
    expect(fnBody).toMatch(/promptMotiv/)
  })
})
