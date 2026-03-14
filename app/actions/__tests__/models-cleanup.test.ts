import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const MODELS_ACTION_PATH = path.resolve(__dirname, '..', 'models.ts')

describe('Dead Code Cleanup - Server Actions', () => {
  /**
   * AC-1: GIVEN `app/actions/models.ts`
   * WHEN nach den Funktionen `getFavoriteModels`, `toggleFavoriteModel`,
   *      `getProjectSelectedModels`, `saveProjectSelectedModels` gesucht wird
   * THEN existiert KEINE dieser Funktionen mehr
   *      (weder als Export noch als interne Funktion)
   */

  const fileContent = fs.existsSync(MODELS_ACTION_PATH)
    ? fs.readFileSync(MODELS_ACTION_PATH, 'utf-8')
    : ''

  it('should not export getFavoriteModels from app/actions/models.ts', () => {
    // If the file was deleted entirely, the function is gone -- pass.
    // If the file exists, it must not contain getFavoriteModels as a function declaration or export.
    if (!fs.existsSync(MODELS_ACTION_PATH)) return
    expect(fileContent).not.toMatch(/export\s+(async\s+)?function\s+getFavoriteModels/)
    expect(fileContent).not.toMatch(/function\s+getFavoriteModels/)
  })

  it('should not export toggleFavoriteModel from app/actions/models.ts', () => {
    if (!fs.existsSync(MODELS_ACTION_PATH)) return
    expect(fileContent).not.toMatch(/export\s+(async\s+)?function\s+toggleFavoriteModel/)
    expect(fileContent).not.toMatch(/function\s+toggleFavoriteModel/)
  })

  it('should not export getProjectSelectedModels from app/actions/models.ts', () => {
    if (!fs.existsSync(MODELS_ACTION_PATH)) return
    expect(fileContent).not.toMatch(/export\s+(async\s+)?function\s+getProjectSelectedModels/)
    expect(fileContent).not.toMatch(/function\s+getProjectSelectedModels/)
  })

  it('should not export saveProjectSelectedModels from app/actions/models.ts', () => {
    if (!fs.existsSync(MODELS_ACTION_PATH)) return
    expect(fileContent).not.toMatch(/export\s+(async\s+)?function\s+saveProjectSelectedModels/)
    expect(fileContent).not.toMatch(/function\s+saveProjectSelectedModels/)
  })
})
