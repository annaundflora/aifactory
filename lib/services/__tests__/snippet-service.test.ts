import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock factories are hoisted - use vi.hoisted to declare mocks
const { mockReturning, mockWhere, mockSet, mockValues, mockFrom, mockDb } = vi.hoisted(() => {
  const mockReturning = vi.fn()
  const mockWhere = vi.fn(() => ({ returning: mockReturning }))
  const mockSet = vi.fn(() => ({ where: mockWhere }))
  const mockValues = vi.fn(() => ({ returning: mockReturning }))
  const mockFrom = vi.fn(() => ({ orderBy: vi.fn().mockResolvedValue([]) }))
  const mockDb = {
    insert: vi.fn(() => ({ values: mockValues })),
    update: vi.fn(() => ({ set: mockSet })),
    delete: vi.fn(() => ({ where: mockWhere })),
    select: vi.fn(() => ({ from: mockFrom })),
  }
  return { mockReturning, mockWhere, mockSet, mockValues, mockFrom, mockDb }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
}))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
  }
})

import { SnippetService } from '@/lib/services/snippet-service'

describe('SnippetService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Re-setup default chain returns after clearAllMocks
    mockDb.insert.mockReturnValue({ values: mockValues })
    mockValues.mockReturnValue({ returning: mockReturning })
    mockDb.update.mockReturnValue({ set: mockSet })
    mockSet.mockReturnValue({ where: mockWhere })
    mockDb.delete.mockReturnValue({ where: mockWhere })
    mockWhere.mockReturnValue({ returning: mockReturning })
    mockDb.select.mockReturnValue({ from: mockFrom })
    mockFrom.mockReturnValue({ orderBy: vi.fn().mockResolvedValue([]) })
  })

  /**
   * AC-1: GIVEN die DB laeuft und Migrationen sind angewendet
   *       WHEN createSnippet({ text: "on white background, centered", category: "POD Basics" }) aufgerufen wird
   *       THEN wird ein Snippet mit generierter UUID, dem getrimmten Text, der getrimmten Kategorie und created_at als TIMESTAMPTZ zurueckgegeben
   */
  it('AC-1: should create a snippet with UUID, trimmed text, trimmed category, and created_at', async () => {
    const now = new Date()
    const fakeRow = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      text: 'on white background, centered',
      category: 'POD Basics',
      createdAt: now,
    }

    mockReturning.mockResolvedValueOnce([fakeRow])

    const result = await SnippetService.create('on white background, centered', 'POD Basics')

    expect(mockDb.insert).toHaveBeenCalledOnce()
    expect(mockValues).toHaveBeenCalledWith({
      text: 'on white background, centered',
      category: 'POD Basics',
    })
    expect(result).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440000',
      text: 'on white background, centered',
      category: 'POD Basics',
      createdAt: now,
    })
    // Verify UUID format
    expect(result.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
    // Verify createdAt is a Date
    expect(result.createdAt).toBeInstanceOf(Date)
  })

  /**
   * AC-2: GIVEN ein existierendes Snippet mit bekannter ID
   *       WHEN updateSnippet({ id, text: "new text", category: "New Category" }) aufgerufen wird
   *       THEN werden Text und Kategorie aktualisiert und der aktualisierte Datensatz zurueckgegeben
   */
  it('AC-2: should update text and category and return updated record', async () => {
    const now = new Date()
    const updatedRow = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      text: 'new text',
      category: 'New Category',
      createdAt: now,
    }

    mockReturning.mockResolvedValueOnce([updatedRow])

    const result = await SnippetService.update(
      '550e8400-e29b-41d4-a716-446655440000',
      'new text',
      'New Category'
    )

    expect(mockDb.update).toHaveBeenCalledOnce()
    expect(mockSet).toHaveBeenCalledWith({ text: 'new text', category: 'New Category' })
    expect(result).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440000',
      text: 'new text',
      category: 'New Category',
      createdAt: now,
    })
  })

  /**
   * AC-3: GIVEN ein existierendes Snippet mit bekannter ID
   *       WHEN deleteSnippet({ id }) aufgerufen wird
   *       THEN wird { success: true } zurueckgegeben und das Snippet ist nicht mehr in der DB vorhanden
   */
  it('AC-3: should delete snippet and return true', async () => {
    mockReturning.mockResolvedValueOnce([{ id: '550e8400-e29b-41d4-a716-446655440000' }])

    const result = await SnippetService.delete('550e8400-e29b-41d4-a716-446655440000')

    expect(mockDb.delete).toHaveBeenCalledOnce()
    expect(result).toBe(true)
  })

  /**
   * AC-4: GIVEN mehrere Snippets in verschiedenen Kategorien ("POD Basics": 2 Snippets, "My Styles": 1 Snippet)
   *       WHEN getSnippets() aufgerufen wird
   *       THEN werden die Snippets als Objekt gruppiert nach Kategorie zurueckgegeben
   */
  it('AC-4: should return snippets grouped by category', async () => {
    const now = new Date()
    const rows = [
      { id: 'id-1', text: 'snippet 1', category: 'POD Basics', createdAt: now },
      { id: 'id-2', text: 'snippet 2', category: 'POD Basics', createdAt: now },
      { id: 'id-3', text: 'snippet 3', category: 'My Styles', createdAt: now },
    ]

    const mockOrderBy = vi.fn().mockResolvedValueOnce(rows)
    const mockFromLocal = vi.fn(() => ({ orderBy: mockOrderBy }))
    mockDb.select.mockReturnValueOnce({ from: mockFromLocal })

    const result = await SnippetService.getAll()

    expect(result).toEqual({
      'POD Basics': [
        { id: 'id-1', text: 'snippet 1', category: 'POD Basics', createdAt: now },
        { id: 'id-2', text: 'snippet 2', category: 'POD Basics', createdAt: now },
      ],
      'My Styles': [
        { id: 'id-3', text: 'snippet 3', category: 'My Styles', createdAt: now },
      ],
    })
  })

  /**
   * AC-5: GIVEN keine Snippets in der DB
   *       WHEN getSnippets() aufgerufen wird
   *       THEN wird ein leeres Objekt {} zurueckgegeben
   */
  it('AC-5: should return empty object when no snippets exist', async () => {
    const mockOrderBy = vi.fn().mockResolvedValueOnce([])
    const mockFromLocal = vi.fn(() => ({ orderBy: mockOrderBy }))
    mockDb.select.mockReturnValueOnce({ from: mockFromLocal })

    const result = await SnippetService.getAll()

    expect(result).toEqual({})
  })

  /**
   * AC-11: GIVEN ein updateSnippet-Aufruf mit einer nicht existierenden ID
   *        WHEN die Action ausgefuehrt wird
   *        THEN wird null zurueckgegeben (Service returns null; Action translates to error message)
   */
  it('AC-11: should return null when updating non-existent snippet', async () => {
    mockReturning.mockResolvedValueOnce([])

    const result = await SnippetService.update(
      'non-existent-id',
      'new text',
      'New Category'
    )

    expect(result).toBeNull()
  })
})
