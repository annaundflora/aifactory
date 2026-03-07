// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

// ---------------------------------------------------------------------------
// Polyfills for jsdom (Radix UI Dialog needs these)
// ---------------------------------------------------------------------------

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

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
      const startTransition = actual.useCallback(
        (fn: () => void | Promise<void>) => {
          setIsPending(true)
          const result = fn()
          if (result && typeof result === 'object' && 'then' in result) {
            ;(result as Promise<void>).then(
              () => setIsPending(false),
              () => setIsPending(false)
            )
          } else {
            setIsPending(false)
          }
        },
        []
      )
      return [isPending, startTransition] as [boolean, typeof startTransition]
    },
  }
})

// Mock lucide-react XIcon used by Dialog close button
vi.mock('lucide-react', () => ({
  XIcon: (props: Record<string, unknown>) => (
    <svg data-testid="x-icon" {...props} />
  ),
}))

// Import AFTER mocks
import { LLMComparison } from '@/components/prompt-improve/llm-comparison'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultProps = {
  prompt: 'A cat on a roof',
  modelId: 'flux-2-pro',
  modelDisplayName: 'FLUX 2 Pro',
  onAdopt: vi.fn(),
  onDiscard: vi.fn(),
}

function renderModal(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides }
  // Reset callback mocks for each render
  props.onAdopt = overrides.onAdopt ?? vi.fn()
  props.onDiscard = overrides.onDiscard ?? vi.fn()
  const result = render(<LLMComparison {...props} />)
  return { ...result, props }
}

// ---------------------------------------------------------------------------
// Tests: LLMComparison Modal (Slice 18)
// ---------------------------------------------------------------------------

describe('LLMComparison Modal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // AC-1: Dialog oeffnet sich mit Titel und Close-Button
  // -------------------------------------------------------------------------

  /**
   * AC-1: GIVEN der User hat einen Prompt im Motiv-Feld eingegeben und ein Modell ausgewaehlt
   *       WHEN der User auf "Improve" klickt
   *       THEN oeffnet sich ein shadcn Dialog (Modal) mit dem Titel "Improve Prompt"
   *            und einem Close-Button (X)
   */
  it('AC-1: should render as a shadcn Dialog with title "Improve Prompt" and close button', () => {
    mockImprovePrompt.mockReturnValue(new Promise(() => {}))

    renderModal()

    // Dialog role should be present (Radix Dialog renders role="dialog")
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Title "Improve Prompt" should be visible
    expect(screen.getByText('Improve Prompt')).toBeInTheDocument()

    // Close button (X) should be present -- shadcn DialogContent renders
    // a close button with sr-only text "Close"
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // AC-2: Loading-State mit Original links und Skeleton rechts
  // -------------------------------------------------------------------------

  /**
   * AC-2: GIVEN das Improve-Modal ist geoeffnet und der LLM-Call laeuft
   *       WHEN der User wartet
   *       THEN zeigt die linke Spalte den Original-Prompt-Text und die rechte Spalte
   *            Skeleton-Platzhalter, dazu ein Spinner mit Text "Improving prompt..."
   */
  it('AC-2: should show original prompt on left and skeleton placeholders on right during loading', () => {
    // Never resolve to keep loading state
    mockImprovePrompt.mockReturnValue(new Promise(() => {}))

    renderModal({ prompt: 'A cat on a roof' })

    // Original prompt text should be visible in left column
    expect(screen.getByText('A cat on a roof')).toBeInTheDocument()
    expect(screen.getByText('Original')).toBeInTheDocument()

    // Skeleton placeholders should be present (rendered via shadcn Skeleton)
    const dialog = screen.getByRole('dialog')
    const skeletons = dialog.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThanOrEqual(1)

    // Spinner text "Improving prompt..." should be visible
    expect(screen.getByText('Improving prompt...')).toBeInTheDocument()

    // Adopt/Discard buttons should NOT be visible during loading
    expect(screen.queryByRole('button', { name: /adopt/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /discard/i })).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // AC-3: Side-by-Side mit Modell-Badge nach erfolgreichem LLM-Call
  // -------------------------------------------------------------------------

  /**
   * AC-3: GIVEN der LLM-Call ist erfolgreich abgeschlossen
   *       WHEN das Ergebnis angezeigt wird
   *       THEN zeigt das Modal Side-by-Side: links "Original" (read-only), rechts "Improved"
   *            (read-only), darunter ein Badge "Optimized for: {Modell-DisplayName}"
   *            (z.B. "Optimized for: FLUX 2 Pro")
   */
  it('AC-3: should display side-by-side comparison with "Optimized for: {modelName}" badge after success', async () => {
    mockImprovePrompt.mockResolvedValueOnce({
      original: 'A cat on a roof',
      improved: 'A majestic feline perched atop a sunlit rooftop at golden hour',
    })

    renderModal({
      prompt: 'A cat on a roof',
      modelDisplayName: 'FLUX 2 Pro',
    })

    // Wait for result to render
    await waitFor(() => {
      expect(screen.getByText('Improved')).toBeInTheDocument()
    })

    // Left column: "Original" label + original text
    expect(screen.getByText('Original')).toBeInTheDocument()
    expect(screen.getByText('A cat on a roof')).toBeInTheDocument()

    // Right column: "Improved" label + improved text
    expect(screen.getByText('Improved')).toBeInTheDocument()
    expect(
      screen.getByText(
        'A majestic feline perched atop a sunlit rooftop at golden hour'
      )
    ).toBeInTheDocument()

    // Badge with model display name
    expect(
      screen.getByText('Optimized for: FLUX 2 Pro')
    ).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // AC-4: Adopt uebernimmt improved Prompt und schliesst Modal
  // -------------------------------------------------------------------------

  /**
   * AC-4: GIVEN das Modal zeigt den Side-by-Side Vergleich
   *       WHEN der User auf "Adopt" klickt
   *       THEN wird der improved Prompt ins Prompt-Feld uebernommen und das Modal schliesst sich
   */
  it('AC-4: should call onAdopt with improved text and close modal when Adopt is clicked', async () => {
    const user = userEvent.setup()
    const onAdopt = vi.fn()
    const onDiscard = vi.fn()

    mockImprovePrompt.mockResolvedValueOnce({
      original: 'A cat on a roof',
      improved: 'A majestic feline perched atop a sunlit rooftop',
    })

    renderModal({ onAdopt, onDiscard })

    // Wait for Adopt button to appear (result state)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /adopt/i })).toBeInTheDocument()
    })

    // Click Adopt
    await user.click(screen.getByRole('button', { name: /adopt/i }))

    // onAdopt should be called with the improved text
    expect(onAdopt).toHaveBeenCalledWith(
      'A majestic feline perched atop a sunlit rooftop'
    )

    // onDiscard should NOT have been called
    expect(onDiscard).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // AC-5: Discard schliesst Modal ohne Aenderung
  // -------------------------------------------------------------------------

  /**
   * AC-5: GIVEN das Modal zeigt den Side-by-Side Vergleich
   *       WHEN der User auf "Discard" klickt
   *       THEN schliesst sich das Modal ohne Aenderungen am Prompt-Feld
   */
  it('AC-5: should call onDiscard and close modal when Discard is clicked', async () => {
    const user = userEvent.setup()
    const onAdopt = vi.fn()
    const onDiscard = vi.fn()

    mockImprovePrompt.mockResolvedValueOnce({
      original: 'A cat on a roof',
      improved: 'A majestic feline perched atop a sunlit rooftop',
    })

    renderModal({ onAdopt, onDiscard })

    // Wait for Discard button to appear (result state)
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /discard/i })
      ).toBeInTheDocument()
    })

    // Click Discard
    await user.click(screen.getByRole('button', { name: /discard/i }))

    // onDiscard should be called
    expect(onDiscard).toHaveBeenCalled()

    // onAdopt should NOT have been called
    expect(onAdopt).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // AC-6: Fehler zeigt Toast und schliesst Modal
  // -------------------------------------------------------------------------

  /**
   * AC-6: GIVEN der LLM-Call schlaegt fehl
   *       WHEN ein Fehler auftritt
   *       THEN wird ein Toast "Prompt-Verbesserung fehlgeschlagen" angezeigt und das Modal
   *            schliesst automatisch
   */
  it('AC-6: should show error toast and close modal when LLM call fails', async () => {
    const onDiscard = vi.fn()

    mockImprovePrompt.mockResolvedValueOnce({
      error: 'Something went wrong',
    })

    renderModal({ onDiscard })

    // Toast should be called with error message
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        'Prompt-Verbesserung fehlgeschlagen'
      )
    })

    // Modal should close automatically via onDiscard
    expect(onDiscard).toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // AC-7: modelId wird an improvePrompt Action uebergeben
  // -------------------------------------------------------------------------

  /**
   * AC-7: GIVEN der Improve-Button in prompt-area.tsx
   *       WHEN der User auf "Improve" klickt
   *       THEN wird die aktuell ausgewaehlte modelId (aus dem Model-Dropdown) an die
   *            LLMComparison-Komponente uebergeben
   */
  it('AC-7: should receive modelId prop and pass it to improvePrompt action', async () => {
    mockImprovePrompt.mockResolvedValueOnce({
      original: 'A cat on a roof',
      improved: 'A majestic feline perched atop a sunlit rooftop',
    })

    renderModal({
      prompt: 'A cat on a roof',
      modelId: 'flux-2-pro',
    })

    // Wait for the improvePrompt call to happen (on mount)
    await waitFor(() => {
      expect(mockImprovePrompt).toHaveBeenCalledTimes(1)
    })

    // Verify modelId was passed to the action
    expect(mockImprovePrompt).toHaveBeenCalledWith({
      prompt: 'A cat on a roof',
      modelId: 'flux-2-pro',
    })
  })

  // -------------------------------------------------------------------------
  // Additional: Close button (X) triggers onDiscard
  // -------------------------------------------------------------------------

  it('should call onDiscard when Dialog close button (X) is clicked', async () => {
    const user = userEvent.setup()
    const onDiscard = vi.fn()

    mockImprovePrompt.mockReturnValue(new Promise(() => {}))

    renderModal({ onDiscard })

    // Click the X close button
    const closeButton = screen.getByRole('button', { name: /close/i })
    await user.click(closeButton)

    // onDiscard should be called via onOpenChange(false)
    expect(onDiscard).toHaveBeenCalled()
  })
})
