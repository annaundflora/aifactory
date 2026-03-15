import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const SCHEMA_PATH = path.resolve(__dirname, '..', 'schema.ts')

describe('Dead Code Cleanup - Schema Deprecation Comments', () => {
  /**
   * AC-3: GIVEN `lib/db/schema.ts`
   * WHEN die Tabellen-Definitionen `favoriteModels` und `projectSelectedModels`
   *      inspiziert werden
   * THEN hat jede Definition einen JSDoc-Kommentar `@deprecated` mit Verweis
   *      auf `model_settings` als Ersatz
   */

  const fileContent = fs.readFileSync(SCHEMA_PATH, 'utf-8')

  it('should have @deprecated JSDoc comment on favoriteModels table definition', () => {
    // Find the JSDoc block immediately preceding `export const favoriteModels`
    const pattern = /\/\*\*[\s\S]*?@deprecated[\s\S]*?model_settings[\s\S]*?\*\/\s*export\s+const\s+favoriteModels/
    expect(fileContent).toMatch(pattern)
  })

  it('should have @deprecated JSDoc comment on projectSelectedModels table definition', () => {
    // Find the JSDoc block immediately preceding `export const projectSelectedModels`
    const pattern = /\/\*\*[\s\S]*?@deprecated[\s\S]*?model_settings[\s\S]*?\*\/\s*export\s+const\s+projectSelectedModels/
    expect(fileContent).toMatch(pattern)
  })
})
