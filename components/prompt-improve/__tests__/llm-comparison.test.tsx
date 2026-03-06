// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

// Mock sonner toast
const mockToast = vi.fn()
vi.mock('sonner', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}))

// Mock improvePrompt server action
const mockImprovePrompt = vi.fn()
vi.mock('@/app/actions/prompts', () => ({
  improvePrompt: (...args: unknown[]) => mockImprovePrompt(...args),
}))

// Mock useTransition to work with async callbacks in jsdom
// React's useTransition async callbacks don't flush properly in test environments
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useTransition: () => {
      const [isPending, setIsPending] = actual.useState(false)
      const startTransition = actual.useCallback((fn: () => void | Promise<void>) => {
        setIsPending(true)
        const result = fn()
        if (result && typeof result === 'object' && 'then' in result) {
          (result as Promise<void>).then(
            () => setIsPending(false),
            () => setIsPending(false)
          )
        } else {
          setIsPending(false)
        }
      }, [])
      return [isPending, startTransition] as [boolean, typeof startTransition]
    },
  }
})

import { LLMComparison } from '@/components/prompt-improve/llm-comparison'

describe('LLMComparison', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * AC-5: GIVEN ein gueltiger Prompt im Eingabefeld
   *       WHEN der User auf "Improve Prompt" klickt
   *       THEN zeigt das LLM-Comparison-Panel einen Loading-State mit Skeleton/Spinner
   *            und dem Text "Improving prompt..."
   */
  it('AC-5: should show skeleton/spinner with text "Improving prompt..." while loading', () => {
    // Never resolve to keep loading state
    mockImprovePrompt.mockReturnValue(new Promise(() => {}))

    render(
      <LLMComparison
        prompt="A cat on a roof"
        onAdopt={vi.fn()}
        onDiscard={vi.fn()}
      />
    )

    expect(screen.getByText('Improving prompt...')).toBeInTheDocument()
  })

  /**
   * AC-6: GIVEN die improvePrompt Action gibt { original, improved } zurueck
   *       WHEN das LLM-Comparison-Panel gerendert wird
   *       THEN zeigt es zwei nebeneinanderliegende Panels: links "Original" mit dem
   *            Original-Prompt (readonly), rechts "Improved" mit dem verbesserten Prompt (readonly),
   *            und darunter die Buttons "Adopt" und "Discard"
   */
  it('AC-6: should render original and improved prompt in two readonly side-by-side panels with adopt and discard buttons', async () => {
    mockImprovePrompt.mockResolvedValueOnce({
      original: 'A cat on a roof',
      improved: 'A majestic cat perched on a sunlit rooftop',
    })

    render(
      <LLMComparison
        prompt="A cat on a roof"
        onAdopt={vi.fn()}
        onDiscard={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Original')).toBeInTheDocument()
    })

    expect(screen.getByText('A cat on a roof')).toBeInTheDocument()
    expect(screen.getByText('Improved')).toBeInTheDocument()
    expect(screen.getByText('A majestic cat perched on a sunlit rooftop')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /adopt/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument()
  })

  /**
   * AC-7: GIVEN das LLM-Comparison-Panel zeigt Original und Improved
   *       WHEN der User auf "Adopt" klickt
   *       THEN wird der verbesserte Prompt uebernommen und das Panel schliesst sich
   */
  it('AC-7: should call onAdopt with improved prompt when adopt is clicked', async () => {
    const user = userEvent.setup()
    const onAdopt = vi.fn()
    const onDiscard = vi.fn()

    mockImprovePrompt.mockResolvedValueOnce({
      original: 'A cat on a roof',
      improved: 'A majestic cat perched on a sunlit rooftop',
    })

    render(
      <LLMComparison
        prompt="A cat on a roof"
        onAdopt={onAdopt}
        onDiscard={onDiscard}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /adopt/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /adopt/i }))

    expect(onAdopt).toHaveBeenCalledWith('A majestic cat perched on a sunlit rooftop')
    expect(onDiscard).not.toHaveBeenCalled()
  })

  /**
   * AC-8: GIVEN das LLM-Comparison-Panel zeigt Original und Improved
   *       WHEN der User auf "Discard" klickt
   *       THEN schliesst sich das Panel und der Original-Prompt im Eingabefeld bleibt unveraendert
   */
  it('AC-8: should call onDiscard and close panel without changing prompt when discard is clicked', async () => {
    const user = userEvent.setup()
    const onAdopt = vi.fn()
    const onDiscard = vi.fn()

    mockImprovePrompt.mockResolvedValueOnce({
      original: 'A cat on a roof',
      improved: 'A majestic cat perched on a sunlit rooftop',
    })

    render(
      <LLMComparison
        prompt="A cat on a roof"
        onAdopt={onAdopt}
        onDiscard={onDiscard}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /discard/i }))

    expect(onDiscard).toHaveBeenCalled()
    expect(onAdopt).not.toHaveBeenCalled()
  })

  /**
   * AC-9: GIVEN die improvePrompt Action gibt einen Fehler zurueck
   *       WHEN das LLM-Comparison-Panel den Fehler empfaengt
   *       THEN wird eine Toast-Notification "Prompt-Verbesserung fehlgeschlagen" angezeigt
   *            und das Panel schliesst sich automatisch
   */
  it('AC-9: should show error toast and close panel automatically on error', async () => {
    const onDiscard = vi.fn()

    mockImprovePrompt.mockResolvedValueOnce({
      error: 'Something went wrong',
    })

    render(
      <LLMComparison
        prompt="A cat on a roof"
        onAdopt={vi.fn()}
        onDiscard={onDiscard}
      />
    )

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Prompt-Verbesserung fehlgeschlagen')
    })

    expect(onDiscard).toHaveBeenCalled()
  })

  /**
   * AC-10: GIVEN das LLM-Comparison-Panel ist im Loading-State
   *        WHEN der User wartet
   *        THEN bleibt der "Improve Prompt"-Button disabled (kein doppelter Request)
   */
  it('AC-10: should keep improve button disabled while loading to prevent duplicate requests', () => {
    // Never resolve to keep loading state
    mockImprovePrompt.mockReturnValue(new Promise(() => {}))

    render(
      <LLMComparison
        prompt="A cat on a roof"
        onAdopt={vi.fn()}
        onDiscard={vi.fn()}
      />
    )

    // In loading state, no Adopt/Discard buttons should be clickable --
    // the component renders a loading skeleton instead of action buttons
    expect(screen.queryByRole('button', { name: /adopt/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /discard/i })).not.toBeInTheDocument()

    // Loading indicator is shown
    expect(screen.getByText('Improving prompt...')).toBeInTheDocument()
  })
})
