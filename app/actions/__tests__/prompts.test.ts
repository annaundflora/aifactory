import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock SnippetService
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockGetAll = vi.fn()

// Mock PromptService
const mockImprove = vi.fn()

vi.mock('@/lib/services/snippet-service', () => ({
  SnippetService: {
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    getAll: (...args: unknown[]) => mockGetAll(...args),
  },
}))

vi.mock('@/lib/services/prompt-service', () => ({
  PromptService: {
    improve: (...args: unknown[]) => mockImprove(...args),
  },
}))

import { createSnippet, updateSnippet, deleteSnippet, getSnippets, improvePrompt } from '@/app/actions/prompts'

describe('Snippet Server Actions - Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should reject empty text with "Snippet-Text darf nicht leer sein"', async () => {
    const result = await createSnippet({ text: '', category: 'POD Basics' })

    expect(result).toEqual({ error: 'Snippet-Text darf nicht leer sein' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('should reject text longer than 500 chars with max-length error', async () => {
    const longText = 'a'.repeat(501)
    const result = await createSnippet({ text: longText, category: 'POD Basics' })

    expect(result).toEqual({ error: 'Snippet-Text darf maximal 500 Zeichen lang sein' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('should reject empty category with "Kategorie darf nicht leer sein"', async () => {
    const result = await createSnippet({ text: 'valid text', category: '' })

    expect(result).toEqual({ error: 'Kategorie darf nicht leer sein' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('should reject category longer than 100 chars with max-length error', async () => {
    const longCategory = 'b'.repeat(101)
    const result = await createSnippet({ text: 'valid text', category: longCategory })

    expect(result).toEqual({ error: 'Kategorie darf maximal 100 Zeichen lang sein' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('should trim text and category before saving', async () => {
    const now = new Date()
    mockCreate.mockResolvedValueOnce({
      id: 'some-uuid',
      text: 'hello',
      category: 'POD',
      createdAt: now,
    })

    const result = await createSnippet({ text: '  hello  ', category: '  POD  ' })

    expect(mockCreate).toHaveBeenCalledWith('hello', 'POD')
    expect(result).toEqual({
      id: 'some-uuid',
      text: 'hello',
      category: 'POD',
      createdAt: now,
    })
  })

  it('should apply same validation rules on updateSnippet as on createSnippet', async () => {
    const result1 = await updateSnippet({ id: 'some-id', text: '', category: 'POD' })
    expect(result1).toEqual({ error: 'Snippet-Text darf nicht leer sein' })

    const result2 = await updateSnippet({
      id: 'some-id',
      text: 'a'.repeat(501),
      category: 'POD',
    })
    expect(result2).toEqual({ error: 'Snippet-Text darf maximal 500 Zeichen lang sein' })

    const result3 = await updateSnippet({ id: 'some-id', text: 'valid', category: '' })
    expect(result3).toEqual({ error: 'Kategorie darf nicht leer sein' })

    const result4 = await updateSnippet({
      id: 'some-id',
      text: 'valid',
      category: 'b'.repeat(101),
    })
    expect(result4).toEqual({ error: 'Kategorie darf maximal 100 Zeichen lang sein' })

    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('Snippet Server Actions - CRUD via Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call SnippetService.update and return "Snippet nicht gefunden" for non-existent ID', async () => {
    mockUpdate.mockResolvedValueOnce(null)

    const result = await updateSnippet({ id: 'non-existent', text: 'valid', category: 'Cat' })

    expect(result).toEqual({ error: 'Snippet nicht gefunden' })
  })

  it('should call SnippetService.delete and return success', async () => {
    mockDelete.mockResolvedValueOnce(true)

    const result = await deleteSnippet({ id: 'some-id' })

    expect(result).toEqual({ success: true })
  })

  it('should call SnippetService.getAll and return grouped snippets', async () => {
    const grouped = { 'POD Basics': [{ id: '1', text: 'a', category: 'POD Basics', createdAt: new Date() }] }
    mockGetAll.mockResolvedValueOnce(grouped)

    const result = await getSnippets()

    expect(result).toEqual(grouped)
  })

  it('should return empty object when getSnippets encounters an error', async () => {
    mockGetAll.mockRejectedValueOnce(new Error('DB error'))

    const result = await getSnippets()

    expect(result).toEqual({})
  })
})

describe('improvePrompt Server Action - modelId Parameter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * AC-6: GIVEN die Server Action `improvePrompt` wird mit
   *       `{ prompt: "test", modelId: "google/imagen-4-fast" }` aufgerufen
   *       WHEN die Action den PromptService aufruft
   *       THEN wird `PromptService.improve("test", "google/imagen-4-fast")`
   *            mit beiden Parametern aufgerufen
   */
  it('AC-6: should pass modelId to PromptService.improve when provided', async () => {
    mockImprove.mockResolvedValueOnce({
      original: 'test',
      improved: 'an improved test prompt',
    })

    const result = await improvePrompt({ prompt: 'test', modelId: 'google/imagen-4-fast' })

    // Verify that PromptService.improve was called with BOTH parameters
    expect(mockImprove).toHaveBeenCalledOnce()
    expect(mockImprove).toHaveBeenCalledWith('test', 'google/imagen-4-fast')

    // Verify the result is passed through correctly
    expect(result).toEqual({
      original: 'test',
      improved: 'an improved test prompt',
    })
  })

  /**
   * AC-7: GIVEN die Server Action `improvePrompt` wird mit leerem `modelId` aufgerufen
   *       WHEN die Validierung laeuft
   *       THEN gibt die Action `{ error: "..." }` zurueck (modelId ist Pflicht)
   */
  it('AC-7: should return error when modelId is empty', async () => {
    const result = await improvePrompt({ prompt: 'test', modelId: '' })

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toBeTruthy()
    expect(mockImprove).not.toHaveBeenCalled()
  })

  it('AC-7: should return error when modelId is only whitespace', async () => {
    const result = await improvePrompt({ prompt: 'test', modelId: '   ' })

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toBeTruthy()
    expect(mockImprove).not.toHaveBeenCalled()
  })

  // --- Regression: empty prompt validation still works ---

  it('should return error object when prompt is empty without calling service', async () => {
    const result = await improvePrompt({ prompt: '', modelId: 'google/imagen-4-fast' })

    expect(result).toEqual({ error: 'Prompt darf nicht leer sein' })
    expect(mockImprove).not.toHaveBeenCalled()
  })

  it('should return error object when prompt is only whitespace', async () => {
    const result = await improvePrompt({ prompt: '   ', modelId: 'google/imagen-4-fast' })

    expect(result).toEqual({ error: 'Prompt darf nicht leer sein' })
    expect(mockImprove).not.toHaveBeenCalled()
  })

  it('should return error object when PromptService.improve throws', async () => {
    mockImprove.mockRejectedValueOnce(new Error('API error'))

    const result = await improvePrompt({ prompt: 'A cat', modelId: 'google/imagen-4-fast' })

    expect(result).toHaveProperty('error')
  })
})
