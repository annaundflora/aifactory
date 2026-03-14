import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const QUERIES_PATH = path.resolve(__dirname, '..', 'queries.ts')

describe('Dead Code Cleanup - Query Functions', () => {
  /**
   * AC-2: GIVEN `lib/db/queries.ts`
   * WHEN nach den Funktionen `getFavoriteModelIds`, `addFavoriteModel`,
   *      `removeFavoriteModel`, `getProjectSelectedModelIds`,
   *      `saveProjectSelectedModelIds` gesucht wird
   * THEN existiert KEINE dieser Funktionen mehr
   */

  const fileContent = fs.existsSync(QUERIES_PATH)
    ? fs.readFileSync(QUERIES_PATH, 'utf-8')
    : ''

  it('should not export getFavoriteModelIds from lib/db/queries.ts', () => {
    if (!fs.existsSync(QUERIES_PATH)) return
    expect(fileContent).not.toMatch(/export\s+(async\s+)?function\s+getFavoriteModelIds/)
    expect(fileContent).not.toMatch(/function\s+getFavoriteModelIds/)
  })

  it('should not export addFavoriteModel from lib/db/queries.ts', () => {
    if (!fs.existsSync(QUERIES_PATH)) return
    expect(fileContent).not.toMatch(/export\s+(async\s+)?function\s+addFavoriteModel/)
    expect(fileContent).not.toMatch(/function\s+addFavoriteModel/)
  })

  it('should not export removeFavoriteModel from lib/db/queries.ts', () => {
    if (!fs.existsSync(QUERIES_PATH)) return
    expect(fileContent).not.toMatch(/export\s+(async\s+)?function\s+removeFavoriteModel/)
    expect(fileContent).not.toMatch(/function\s+removeFavoriteModel/)
  })

  it('should not export getProjectSelectedModelIds from lib/db/queries.ts', () => {
    if (!fs.existsSync(QUERIES_PATH)) return
    expect(fileContent).not.toMatch(/export\s+(async\s+)?function\s+getProjectSelectedModelIds/)
    expect(fileContent).not.toMatch(/function\s+getProjectSelectedModelIds/)
  })

  it('should not export saveProjectSelectedModelIds from lib/db/queries.ts', () => {
    if (!fs.existsSync(QUERIES_PATH)) return
    expect(fileContent).not.toMatch(/export\s+(async\s+)?function\s+saveProjectSelectedModelIds/)
    expect(fileContent).not.toMatch(/function\s+saveProjectSelectedModelIds/)
  })
})
