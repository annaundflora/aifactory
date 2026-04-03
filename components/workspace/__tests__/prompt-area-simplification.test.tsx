// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { createElement, type ReactNode } from 'react'
import * as fs from 'node:fs'
import * as path from 'node:path'

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
// Mocks (mock_external strategy per slice-05 spec)
// ---------------------------------------------------------------------------

// Mock auth chain to prevent next-auth -> next/server resolution error
vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@/lib/auth/guard', () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: 'test-user', email: 'test@example.com' }),
}))

// Mock db to prevent DATABASE_URL crash
vi.mock('@/lib/db', () => ({
  db: {},
}))

// Mock db/queries to prevent DATABASE_URL crash
vi.mock('@/lib/db/queries', () => ({}))

// Mock snippet-service to prevent DATABASE_URL crash
vi.mock('@/lib/services/snippet-service', () => ({
  SnippetService: {
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(false),
    getAll: vi.fn().mockResolvedValue({}),
  },
}))

// Mock prompt actions (pulled by PromptTabs -> HistoryList)
vi.mock('@/app/actions/prompts', () => ({
  getPromptHistory: vi.fn().mockResolvedValue([]),
  toggleFavorite: vi.fn().mockResolvedValue(undefined),
  getFavorites: vi.fn().mockResolvedValue([]),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: vi.fn(),
}))

// Mock server actions: generations
const mockGenerateImages = vi.fn().mockResolvedValue([])
const mockUpscaleImage = vi.fn().mockResolvedValue({})
vi.mock('@/app/actions/generations', () => ({
  generateImages: (...args: unknown[]) => mockGenerateImages(...args),
  upscaleImage: (...args: unknown[]) => mockUpscaleImage(...args),
  uploadSourceImage: vi.fn().mockResolvedValue({ url: 'https://r2.example.com/uploaded.png' }),
}))

// Mock server actions: model-slots (replaces model-settings after slots refactoring)
const mockGetModelSlots = vi.fn().mockResolvedValue([])
vi.mock('@/app/actions/model-slots', () => ({
  getModelSlots: (...args: unknown[]) => mockGetModelSlots(...args),
}))

// Mock server actions: models
const mockGetModels = vi.fn().mockResolvedValue([])
vi.mock('@/app/actions/models', () => ({
  getModels: (...args: unknown[]) => mockGetModels(...args),
  getModelSchema: vi.fn().mockResolvedValue({ properties: {} }),
}))

// Mock server actions: references
vi.mock('@/app/actions/references', () => ({
  uploadReferenceImage: vi.fn().mockResolvedValue({ id: 'ref-1', imageUrl: 'https://example.com/ref.png' }),
  deleteReferenceImage: vi.fn().mockResolvedValue(undefined),
  addGalleryAsReference: vi.fn().mockResolvedValue({ id: 'ref-1', imageUrl: 'https://example.com/ref.png' }),
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const stub = (name: string) => {
    const id = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
    const Comp = (props: Record<string, unknown>) => createElement('span', { 'data-testid': `${id}-icon`, ...props })
    Comp.displayName = name
    return Comp
  }
  return {
    MessageSquare: stub('MessageSquare'), Minus: stub('Minus'), Plus: stub('Plus'),
    ArrowUp: stub('ArrowUp'), Square: stub('Square'), PanelRightClose: stub('PanelRightClose'),
    Image: stub('Image'), Loader2: stub('Loader2'), ImageOff: stub('ImageOff'),
    PanelRightOpen: stub('PanelRightOpen'), PanelLeftIcon: stub('PanelLeftIcon'),
    PanelLeftClose: stub('PanelLeftClose'), PenLine: stub('PenLine'),
    ChevronDown: stub('ChevronDown'), Check: stub('Check'), Type: stub('Type'),
    ImagePlus: stub('ImagePlus'), Scaling: stub('Scaling'), X: stub('X'),
    ArrowLeft: stub('ArrowLeft'), Undo2: stub('Undo2'), Redo2: stub('Redo2'),
    ChevronUp: stub('ChevronUp'), ChevronDownIcon: stub('ChevronDownIcon'),
    ChevronUpIcon: stub('ChevronUpIcon'), CheckIcon: stub('CheckIcon'),
    Info: stub('Info'), Copy: stub('Copy'), ArrowRightLeft: stub('ArrowRightLeft'),
    ZoomIn: stub('ZoomIn'), Download: stub('Download'), Trash2: stub('Trash2'),
    Sparkles: stub('Sparkles'), Library: stub('Library'), Star: stub('Star'),
    ChevronLeft: stub('ChevronLeft'), ChevronRight: stub('ChevronRight'),
    PanelLeftOpen: stub('PanelLeftOpen'), Eraser: stub('Eraser'),
  }
})

// Mock LLMComparison (external component, not under test)
vi.mock('@/components/prompt-improve/llm-comparison', () => ({
  LLMComparison: () => null,
}))

// Mock AssistantTrigger
vi.mock('@/components/assistant/assistant-trigger', () => ({
  AssistantTrigger: (props: Record<string, unknown>) =>
    createElement('button', { 'data-testid': 'assistant-trigger', onClick: props.onClick }),
}))

// Mock AssistantSheet and related
vi.mock('@/components/assistant/assistant-sheet', () => ({
  AssistantSheet: ({ children }: { children: ReactNode }) =>
    createElement('div', { 'data-testid': 'assistant-sheet' }, children),
}))

vi.mock('@/components/assistant/startscreen', () => ({
  Startscreen: () => createElement('div', { 'data-testid': 'startscreen' }),
}))

vi.mock('@/components/assistant/chat-input', () => ({
  ChatInput: () => createElement('div', { 'data-testid': 'chat-input' }),
}))

vi.mock('@/components/assistant/chat-thread', () => ({
  ChatThread: () => createElement('div', { 'data-testid': 'chat-thread' }),
}))

vi.mock('@/components/assistant/prompt-canvas', () => ({
  PromptCanvas: () => createElement('div', { 'data-testid': 'prompt-canvas' }),
}))

vi.mock('@/components/assistant/session-list', () => ({
  SessionList: () => createElement('div', { 'data-testid': 'session-list' }),
}))

vi.mock('@/components/assistant/session-switcher', () => ({
  SessionSwitcher: () => createElement('div', { 'data-testid': 'session-switcher' }),
}))

vi.mock('@/components/assistant/model-selector', () => ({
  ModelSelector: () => createElement('div', { 'data-testid': 'model-selector' }),
}))

// Mock PromptAssistantProvider and hooks
vi.mock('@/lib/assistant/assistant-context', () => ({
  PromptAssistantProvider: ({ children }: { children: ReactNode }) => children,
  usePromptAssistant: () => ({
    messages: [],
    isStreaming: false,
    hasCanvas: false,
    selectedModel: 'gpt-4',
    setSelectedModel: vi.fn(),
    cancelStream: vi.fn(),
    activeView: 'startscreen' as const,
    setActiveView: vi.fn(),
    loadSession: vi.fn(),
    sessionId: null,
    dispatch: vi.fn(),
    sessionIdRef: { current: null },
    sendMessageRef: { current: null },
    cancelStreamRef: { current: null },
    imageModelIdRef: { current: null },
    generationModeRef: { current: null },
  }),
  getWorkspaceFieldsForChip: () => null,
}))

vi.mock('@/lib/assistant/use-assistant-runtime', () => ({
  useAssistantRuntime: () => ({
    sendMessage: vi.fn(),
  }),
}))

// Mock workspace-state
const mockClearVariation = vi.fn()
vi.mock('@/lib/workspace-state', () => ({
  useWorkspaceVariation: () => ({
    variationData: null,
    setVariation: vi.fn(),
    clearVariation: mockClearVariation,
  }),
  WorkspaceStateProvider: ({ children }: { children: ReactNode }) => children,
}))

// Mock ReferenceBar
vi.mock('@/components/workspace/reference-bar', () => ({
  ReferenceBar: () => createElement('div', { 'data-testid': 'reference-bar' }),
  getLowestFreePosition: (occupied: number[]): number => {
    const sorted = [...occupied].sort((a, b) => a - b)
    for (let i = 1; i <= 5; i++) {
      if (!sorted.includes(i)) return i
    }
    return -1
  },
}))

// Mock ImageDropzone
vi.mock('@/components/workspace/image-dropzone', () => ({
  ImageDropzone: (props: Record<string, unknown>) =>
    createElement('div', { 'data-testid': 'image-dropzone', 'data-project-id': props.projectId }),
}))

// Mock SectionLabel
vi.mock('@/components/shared/section-label', () => ({
  SectionLabel: ({ children, ...props }: { children: ReactNode }) =>
    createElement('span', { 'data-testid': 'section-label', ...props }, children),
}))

// Mock modelIdToDisplayName
vi.mock('@/lib/utils/model-display-name', () => ({
  modelIdToDisplayName: (id: string) => id,
}))

// Mock useModelSchema
vi.mock('@/lib/hooks/use-model-schema', () => ({
  useModelSchema: () => ({ schema: null, isLoading: false }),
}))

// Mock ModelSlots component (external, not under test)
vi.mock('@/components/ui/model-slots', () => ({
  ModelSlots: (props: Record<string, unknown>) =>
    createElement('div', { 'data-testid': 'model-slots', 'data-variant': props.variant, 'data-mode': props.mode }),
}))

// Mock ParameterPanel
vi.mock('@/components/workspace/parameter-panel', () => ({
  ParameterPanel: () => null,
}))

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

import { PromptArea } from '@/components/workspace/prompt-area'

// ---------------------------------------------------------------------------
// Fixtures: Model Slots (replaces Model Settings after slots refactoring)
// ---------------------------------------------------------------------------

function makeModelSlots() {
  return [
    { id: 'slot-1', mode: 'txt2img', slot: 1, modelId: 'black-forest-labs/flux-schnell', modelParams: {}, active: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'slot-2', mode: 'txt2img', slot: 2, modelId: 'black-forest-labs/flux-2-pro', modelParams: {}, active: false, createdAt: new Date(), updatedAt: new Date() },
    { id: 'slot-3', mode: 'txt2img', slot: 3, modelId: null, modelParams: {}, active: false, createdAt: new Date(), updatedAt: new Date() },
    { id: 'slot-4', mode: 'img2img', slot: 1, modelId: 'black-forest-labs/flux-schnell', modelParams: { prompt_strength: 0.6 }, active: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'slot-5', mode: 'img2img', slot: 2, modelId: 'black-forest-labs/flux-2-pro', modelParams: {}, active: false, createdAt: new Date(), updatedAt: new Date() },
    { id: 'slot-6', mode: 'img2img', slot: 3, modelId: null, modelParams: {}, active: false, createdAt: new Date(), updatedAt: new Date() },
    { id: 'slot-7', mode: 'upscale', slot: 1, modelId: 'nightmareai/real-esrgan', modelParams: { scale: 2 }, active: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'slot-8', mode: 'upscale', slot: 2, modelId: 'philz1337x/crystal-upscaler', modelParams: { scale: 4 }, active: false, createdAt: new Date(), updatedAt: new Date() },
  ]
}

function makeModels() {
  return [
    { id: 'model-1', replicateId: 'black-forest-labs/flux-schnell', owner: 'black-forest-labs', name: 'flux-schnell', description: null, coverImageUrl: null, runCount: 100, collections: null, capabilities: { txt2img: true, img2img: true }, inputSchema: null, versionHash: null, isActive: true, lastSyncedAt: null, createdAt: new Date(), updatedAt: new Date() },
    { id: 'model-2', replicateId: 'black-forest-labs/flux-2-pro', owner: 'black-forest-labs', name: 'flux-2-pro', description: null, coverImageUrl: null, runCount: 100, collections: null, capabilities: { txt2img: true, img2img: true }, inputSchema: null, versionHash: null, isActive: true, lastSyncedAt: null, createdAt: new Date(), updatedAt: new Date() },
  ]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPromptArea() {
  return render(<PromptArea projectId="proj-test" />)
}

async function switchToMode(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
) {
  const trigger = screen.getByTestId('mode-selector')
  await user.click(trigger)
  const item = await screen.findByRole('menuitem', { name: new RegExp(label, 'i') })
  await user.click(item)
}

// ===========================================================================
// Tests: PromptArea - prompt simplification (slice-05)
// ===========================================================================

describe('PromptArea - prompt simplification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetModelSlots.mockResolvedValue(makeModelSlots())
    mockGetModels.mockResolvedValue(makeModels())
  })

  // -------------------------------------------------------------------------
  // AC-1: Nur 1 Textarea, keine Style/Negative-Felder
  // -------------------------------------------------------------------------
  it('should render only one prompt textarea without style or negative fields', async () => {
    /**
     * AC-1: GIVEN die Komponente PromptArea in prompt-area.tsx
     *       WHEN sie im Browser gerendert wird
     *       THEN existiert genau 1 Textarea mit data-testid="prompt-motiv-textarea"
     *       AND es existiert KEIN Element mit data-testid="prompt-style-textarea"
     *            oder data-testid="negative-prompt-textarea"
     */
    renderPromptArea()

    await waitFor(() => {
      expect(mockGetModelSlots).toHaveBeenCalled()
    })

    // Exactly 1 prompt textarea exists
    const motivTextarea = screen.getByTestId('prompt-motiv-textarea')
    expect(motivTextarea).toBeInTheDocument()
    expect(motivTextarea.tagName.toLowerCase()).toBe('textarea')

    // No style or negative prompt textareas
    expect(screen.queryByTestId('prompt-style-textarea')).not.toBeInTheDocument()
    expect(screen.queryByTestId('negative-prompt-textarea')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // AC-1: Keine Collapsible-Toggles
  // -------------------------------------------------------------------------
  it('should not render style or negative collapsible toggles', async () => {
    /**
     * AC-1: GIVEN die Komponente PromptArea in prompt-area.tsx
     *       WHEN sie im Browser gerendert wird
     *       THEN existiert KEIN Element mit data-testid="prompt-style-toggle"
     *            oder data-testid="prompt-negative-toggle"
     */
    renderPromptArea()

    await waitFor(() => {
      expect(mockGetModelSlots).toHaveBeenCalled()
    })

    expect(screen.queryByTestId('prompt-style-toggle')).not.toBeInTheDocument()
    expect(screen.queryByTestId('prompt-negative-toggle')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // AC-2: Label ist "Prompt", Placeholder angepasst
  // -------------------------------------------------------------------------
  it('should display label "Prompt" instead of "Motiv"', async () => {
    /**
     * AC-2: GIVEN die Komponente PromptArea
     *       WHEN das Label des Prompt-Feldes geprueft wird
     *       THEN lautet der sichtbare Label-Text "Prompt" (nicht "Motiv")
     */
    renderPromptArea()

    await waitFor(() => {
      expect(mockGetModelSlots).toHaveBeenCalled()
    })

    // The label for the prompt textarea should say "Prompt"
    // Note: "Prompt" also appears as a tab trigger text, so we use getAllByText
    const promptElements = screen.getAllByText('Prompt')
    expect(promptElements.length).toBeGreaterThanOrEqual(1)

    // Find the actual <label> element for the textarea
    const textarea = screen.getByTestId('prompt-motiv-textarea')
    const labelEl = document.querySelector(`label[for="${textarea.id}"]`)
    expect(labelEl).not.toBeNull()
    expect(labelEl!.textContent).toContain('Prompt')
    expect(labelEl!.textContent).not.toBe('Motiv')

    // "Motiv" should not appear as a standalone label anywhere
    expect(screen.queryByText('Motiv')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // AC-2: Placeholder-Text
  // -------------------------------------------------------------------------
  it('should display placeholder "Describe your image, including style and mood..."', async () => {
    /**
     * AC-2: GIVEN die Komponente PromptArea
     *       WHEN das Label des Prompt-Feldes geprueft wird
     *       THEN der Placeholder lautet "Describe your image, including style and mood..."
     */
    renderPromptArea()

    await waitFor(() => {
      expect(mockGetModelSlots).toHaveBeenCalled()
    })

    const textarea = screen.getByTestId('prompt-motiv-textarea')
    expect(textarea).toHaveAttribute('placeholder', 'Describe your image, including style and mood...')
  })

  // -------------------------------------------------------------------------
  // AC-3: Txt2ImgState/Img2ImgState ohne promptStyle/negativePrompt
  // -------------------------------------------------------------------------
  it('should not include promptStyle or negativePrompt in Txt2ImgState and Img2ImgState interfaces', () => {
    /**
     * AC-3: GIVEN die Interfaces Txt2ImgState und Img2ImgState in prompt-area.tsx
     *       WHEN ihre Properties geprueft werden
     *       THEN enthaelt KEINES der Interfaces eine Property promptStyle oder negativePrompt
     *       AND Txt2ImgState hat nur: promptMotiv, variantCount, imageParams
     *       AND Img2ImgState hat nur: promptMotiv, variantCount, referenceSlots, imageParams
     */
    const sourcePath = path.resolve(__dirname, '..', 'prompt-area.tsx')
    const source = fs.readFileSync(sourcePath, 'utf-8')

    // Extract Txt2ImgState interface
    const txt2ImgMatch = source.match(
      /interface\s+Txt2ImgState\s*\{([^}]+)\}/s
    )
    expect(txt2ImgMatch).not.toBeNull()
    const txt2ImgBody = txt2ImgMatch![1]
    expect(txt2ImgBody).not.toMatch(/promptStyle/)
    expect(txt2ImgBody).not.toMatch(/negativePrompt/)
    // Verify expected properties exist
    expect(txt2ImgBody).toMatch(/promptMotiv/)
    expect(txt2ImgBody).toMatch(/variantCount/)
    // imageParams moved to per-slot ModelSlots system

    // Extract Img2ImgState interface
    const img2ImgMatch = source.match(
      /interface\s+Img2ImgState\s*\{([^}]+)\}/s
    )
    expect(img2ImgMatch).not.toBeNull()
    const img2ImgBody = img2ImgMatch![1]
    expect(img2ImgBody).not.toMatch(/promptStyle/)
    expect(img2ImgBody).not.toMatch(/negativePrompt/)
    // Verify expected properties exist
    expect(img2ImgBody).toMatch(/promptMotiv/)
    expect(img2ImgBody).toMatch(/variantCount/)
    expect(img2ImgBody).toMatch(/referenceSlots/)
    // imageParams moved to per-slot ModelSlots system
  })

  // -------------------------------------------------------------------------
  // AC-4: createInitialModeStates Rueckgabewert ohne promptStyle/negativePrompt
  // -------------------------------------------------------------------------
  it('should return createInitialModeStates without promptStyle or negativePrompt keys', () => {
    /**
     * AC-4: GIVEN die Funktion createInitialModeStates() in prompt-area.tsx
     *       WHEN ihr Rueckgabewert geprueft wird
     *       THEN enthaelt weder txt2img noch img2img die Keys promptStyle oder negativePrompt
     */
    const sourcePath = path.resolve(__dirname, '..', 'prompt-area.tsx')
    const source = fs.readFileSync(sourcePath, 'utf-8')

    // Extract the createInitialModeStates function body
    const fnMatch = source.match(
      /function\s+createInitialModeStates\(\)[^{]*\{([\s\S]*?)^}/m
    )
    expect(fnMatch).not.toBeNull()
    const fnBody = fnMatch![1]

    // The function body must NOT contain promptStyle or negativePrompt
    expect(fnBody).not.toMatch(/promptStyle/)
    expect(fnBody).not.toMatch(/negativePrompt/)

    // The function body SHOULD contain promptMotiv for both modes
    expect(fnBody).toMatch(/promptMotiv/)
  })

  // -------------------------------------------------------------------------
  // AC-5: Keine useState/useRef fuer entfernte Felder
  // -------------------------------------------------------------------------
  it('should not have useState calls for promptStyle, negativePrompt, styleOpen, or negativeOpen', () => {
    /**
     * AC-5: GIVEN die State-Variablen in der PromptArea-Komponente
     *       WHEN der Quellcode geprueft wird
     *       THEN existieren KEINE useState-Aufrufe fuer promptStyle, negativePrompt,
     *            styleOpen oder negativeOpen
     *       AND es existieren KEINE useRef-Aufrufe fuer styleRef oder negativeRef
     */
    const sourcePath = path.resolve(__dirname, '..', 'prompt-area.tsx')
    const source = fs.readFileSync(sourcePath, 'utf-8')

    // Check no useState for removed fields
    expect(source).not.toMatch(/useState.*promptStyle/s)
    expect(source).not.toMatch(/useState.*negativePrompt/s)
    expect(source).not.toMatch(/useState.*styleOpen/s)
    expect(source).not.toMatch(/useState.*negativeOpen/s)
    expect(source).not.toMatch(/setPromptStyle/)
    expect(source).not.toMatch(/setNegativePrompt/)
    expect(source).not.toMatch(/setStyleOpen/)
    expect(source).not.toMatch(/setNegativeOpen/)

    // Check no useRef for removed refs
    expect(source).not.toMatch(/useRef.*styleRef/s)
    expect(source).not.toMatch(/useRef.*negativeRef/s)
    expect(source).not.toMatch(/styleRef\s*=\s*useRef/)
    expect(source).not.toMatch(/negativeRef\s*=\s*useRef/)
  })

  // -------------------------------------------------------------------------
  // AC-6: generateImages-Aufruf ohne promptStyle/negativePrompt (txt2img)
  // -------------------------------------------------------------------------
  it('should call generateImages without promptStyle or negativePrompt in txt2img mode', async () => {
    /**
     * AC-6: GIVEN ein User der im txt2img-Modus promptMotiv = "a cat on a roof" eingibt
     *       WHEN der User auf "Generate" klickt
     *       THEN wird generateImages() mit { promptMotiv: "a cat on a roof", ... } aufgerufen
     *       AND das Argument enthaelt KEIN promptStyle und KEIN negativePrompt
     */
    const user = userEvent.setup()
    renderPromptArea()

    await waitFor(() => {
      expect(mockGetModelSlots).toHaveBeenCalled()
    })

    // Type the prompt
    const textarea = screen.getByTestId('prompt-motiv-textarea')
    await user.type(textarea, 'a cat on a roof')

    // Click generate
    const generateButton = screen.getByTestId('generate-button')
    await waitFor(() => {
      expect(generateButton).not.toBeDisabled()
    })
    await user.click(generateButton)

    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1)
    })

    const callArgs = mockGenerateImages.mock.calls[0][0]
    expect(callArgs.promptMotiv).toBe('a cat on a roof')
    expect(callArgs).not.toHaveProperty('promptStyle')
    expect(callArgs).not.toHaveProperty('negativePrompt')
  })

  // -------------------------------------------------------------------------
  // AC-7: generateImages-Aufruf ohne promptStyle/negativePrompt (img2img)
  // -------------------------------------------------------------------------
  it('should call generateImages without promptStyle or negativePrompt in img2img mode', async () => {
    /**
     * AC-7: GIVEN ein User der im img2img-Modus generiert
     *       WHEN generateImages() aufgerufen wird
     *       THEN enthaelt das Argument KEIN promptStyle und KEIN negativePrompt
     */
    const user = userEvent.setup()
    renderPromptArea()

    await waitFor(() => {
      expect(mockGetModelSlots).toHaveBeenCalled()
    })

    // Switch to img2img
    await switchToMode(user, 'Image to Image')

    // Type a prompt
    const textarea = screen.getByTestId('prompt-motiv-textarea')
    await user.type(textarea, 'a landscape with mountains')

    // Click generate
    const generateButton = screen.getByTestId('generate-button')
    await waitFor(() => {
      expect(generateButton).not.toBeDisabled()
    })
    await user.click(generateButton)

    await waitFor(() => {
      expect(mockGenerateImages).toHaveBeenCalledTimes(1)
    })

    const callArgs = mockGenerateImages.mock.calls[0][0]
    expect(callArgs.promptMotiv).toBe('a landscape with mountains')
    expect(callArgs.generationMode).toBe('img2img')
    expect(callArgs).not.toHaveProperty('promptStyle')
    expect(callArgs).not.toHaveProperty('negativePrompt')
  })

  // -------------------------------------------------------------------------
  // AC-10: Mode-State-Persistence nur mit promptMotiv
  // -------------------------------------------------------------------------
  it('should persist and restore only promptMotiv on mode switch without promptStyle or negativePrompt', async () => {
    /**
     * AC-10: GIVEN die Mode-State-Persistence (Save/Restore beim Moduswechsel)
     *        WHEN der User von txt2img zu img2img wechselt und zurueck
     *        THEN wird promptMotiv korrekt gespeichert und wiederhergestellt
     *        AND es werden KEINE promptStyle/negativePrompt-Werte gespeichert oder gelesen
     */
    const user = userEvent.setup()
    renderPromptArea()

    await waitFor(() => {
      expect(mockGetModelSlots).toHaveBeenCalled()
    })

    // Type a prompt in txt2img mode
    const textarea = screen.getByTestId('prompt-motiv-textarea')
    await user.type(textarea, 'sunset over ocean')
    expect(textarea).toHaveValue('sunset over ocean')

    // Switch to img2img
    await switchToMode(user, 'Image to Image')

    // Prompt should carry over when switching between prompt-based modes
    const textareaAfterSwitch = screen.getByTestId('prompt-motiv-textarea')
    expect(textareaAfterSwitch).toBeInTheDocument()

    // Switch back to txt2img
    await switchToMode(user, 'Text to Image')

    // Prompt should be preserved
    const textareaBack = screen.getByTestId('prompt-motiv-textarea')
    expect(textareaBack).toHaveValue('sunset over ocean')

    // Verify the source code does NOT save/restore promptStyle or negativePrompt
    // in the mode persistence logic
    const sourcePath = path.resolve(__dirname, '..', 'prompt-area.tsx')
    const source = fs.readFileSync(sourcePath, 'utf-8')

    // Extract saveCurrentModeState function body
    const saveMatch = source.match(
      /const\s+saveCurrentModeState\s*=\s*useCallback\(\(\)\s*=>\s*\{([\s\S]*?)\},\s*\[/
    )
    expect(saveMatch).not.toBeNull()
    const saveBody = saveMatch![1]
    expect(saveBody).not.toMatch(/promptStyle/)
    expect(saveBody).not.toMatch(/negativePrompt/)
  })

  // -------------------------------------------------------------------------
  // AC-11: Keine promptStyle/negativePrompt Props an PromptTabs
  // -------------------------------------------------------------------------
  it('should not pass promptStyle or negativePrompt props to PromptTabs', () => {
    /**
     * AC-11: GIVEN die PromptTabs/HistoryList-Integration in prompt-area.tsx
     *        WHEN onRestore eines History-Eintrags aufgerufen wird
     *        THEN wird nur setPromptMotiv aufgerufen
     *        AND es werden KEINE promptStyle/negativePrompt Props an PromptTabs uebergeben
     */
    const sourcePath = path.resolve(__dirname, '..', 'prompt-area.tsx')
    const source = fs.readFileSync(sourcePath, 'utf-8')

    // Find all <PromptTabs ... > JSX usages
    const promptTabsJsx = source.match(/<PromptTabs[\s\S]*?>/g)
    expect(promptTabsJsx).not.toBeNull()

    for (const jsx of promptTabsJsx!) {
      // Must NOT pass promptStyle or negativePrompt as props
      expect(jsx).not.toMatch(/promptStyle\s*[={]/)
      expect(jsx).not.toMatch(/negativePrompt\s*[={]/)
    }

    // Verify the onLoadHistoryEntry/onRestore callback only sets promptMotiv
    const onLoadMatch = source.match(
      /onLoadHistoryEntry\s*=\s*\{[^}]*\}/s
    )
    expect(onLoadMatch).not.toBeNull()
    const onLoadBody = onLoadMatch![0]
    expect(onLoadBody).toMatch(/setPromptMotiv/)
    expect(onLoadBody).not.toMatch(/setPromptStyle/)
    expect(onLoadBody).not.toMatch(/setNegativePrompt/)
  })
})
