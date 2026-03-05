import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock SnippetService
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockGetAll = vi.fn()

vi.mock('@/lib/services/snippet-service', () => ({
  SnippetService: {
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    getAll: (...args: unknown[]) => mockGetAll(...args),
  },
}))

import { createSnippet, updateSnippet, deleteSnippet, getSnippets } from '@/app/actions/prompts'

describe('Snippet Server Actions - Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * AC-6: GIVEN ein createSnippet-Aufruf mit text: "" (leerer String)
   *       WHEN die Validierung durchlaeuft
   *       THEN wird ein Fehler zurueckgegeben mit Message "Snippet-Text darf nicht leer sein"
   */
  it('AC-6: should reject empty text with "Snippet-Text darf nicht leer sein"', async () => {
    const result = await createSnippet({ text: '', category: 'POD Basics' })

    expect(result).toEqual({ error: 'Snippet-Text darf nicht leer sein' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  /**
   * AC-7: GIVEN ein createSnippet-Aufruf mit text laenger als 500 Zeichen
   *       WHEN die Validierung durchlaeuft
   *       THEN wird ein Fehler zurueckgegeben mit Message "Snippet-Text darf maximal 500 Zeichen lang sein"
   */
  it('AC-7: should reject text longer than 500 chars with max-length error', async () => {
    const longText = 'a'.repeat(501)
    const result = await createSnippet({ text: longText, category: 'POD Basics' })

    expect(result).toEqual({ error: 'Snippet-Text darf maximal 500 Zeichen lang sein' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  /**
   * AC-8: GIVEN ein createSnippet-Aufruf mit category: "" (leerer String)
   *       WHEN die Validierung durchlaeuft
   *       THEN wird ein Fehler zurueckgegeben mit Message "Kategorie darf nicht leer sein"
   */
  it('AC-8: should reject empty category with "Kategorie darf nicht leer sein"', async () => {
    const result = await createSnippet({ text: 'valid text', category: '' })

    expect(result).toEqual({ error: 'Kategorie darf nicht leer sein' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  /**
   * AC-9: GIVEN ein createSnippet-Aufruf mit category laenger als 100 Zeichen
   *       WHEN die Validierung durchlaeuft
   *       THEN wird ein Fehler zurueckgegeben mit Message "Kategorie darf maximal 100 Zeichen lang sein"
   */
  it('AC-9: should reject category longer than 100 chars with max-length error', async () => {
    const longCategory = 'b'.repeat(101)
    const result = await createSnippet({ text: 'valid text', category: longCategory })

    expect(result).toEqual({ error: 'Kategorie darf maximal 100 Zeichen lang sein' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  /**
   * AC-10: GIVEN ein createSnippet-Aufruf mit text: "  hello  " und category: "  POD  "
   *        WHEN die Validierung und Speicherung durchlaeuft
   *        THEN werden Text und Kategorie getrimmt gespeichert: text="hello", category="POD"
   */
  it('AC-10: should trim text and category before saving', async () => {
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

  /**
   * AC-12: GIVEN ein updateSnippet-Aufruf mit text: "" (leerer String)
   *        WHEN die Validierung durchlaeuft
   *        THEN wird derselbe Validierungsfehler wie bei createSnippet zurueckgegeben
   */
  it('AC-12: should apply same validation rules on updateSnippet as on createSnippet', async () => {
    // Empty text
    const result1 = await updateSnippet({ id: 'some-id', text: '', category: 'POD' })
    expect(result1).toEqual({ error: 'Snippet-Text darf nicht leer sein' })

    // Text too long
    const result2 = await updateSnippet({
      id: 'some-id',
      text: 'a'.repeat(501),
      category: 'POD',
    })
    expect(result2).toEqual({ error: 'Snippet-Text darf maximal 500 Zeichen lang sein' })

    // Empty category
    const result3 = await updateSnippet({ id: 'some-id', text: 'valid', category: '' })
    expect(result3).toEqual({ error: 'Kategorie darf nicht leer sein' })

    // Category too long
    const result4 = await updateSnippet({
      id: 'some-id',
      text: 'valid',
      category: 'b'.repeat(101),
    })
    expect(result4).toEqual({ error: 'Kategorie darf maximal 100 Zeichen lang sein' })

    // None of these should have called the service
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
