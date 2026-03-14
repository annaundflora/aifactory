import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const MODELS_PATH = path.resolve(__dirname, '..', 'models.ts')

describe('Dead Code Cleanup - UPSCALE_MODEL Removal', () => {
  /**
   * AC-4: GIVEN `lib/models.ts`
   * WHEN nach dem Export `UPSCALE_MODEL` gesucht wird
   * THEN existiert dieser Export NICHT mehr
   *      (Konstante entfernt oder gesamte Datei geloescht, falls leer)
   */

  it('should not export UPSCALE_MODEL from lib/models.ts', () => {
    // If the file has been deleted entirely, the constant is gone -- pass.
    if (!fs.existsSync(MODELS_PATH)) {
      // File deleted -- UPSCALE_MODEL is definitely removed.
      expect(true).toBe(true)
      return
    }

    // If the file still exists, it must not contain UPSCALE_MODEL.
    const fileContent = fs.readFileSync(MODELS_PATH, 'utf-8')
    expect(fileContent).not.toMatch(/export\s+(const|let|var)\s+UPSCALE_MODEL/)
    expect(fileContent).not.toMatch(/UPSCALE_MODEL/)
  })
})
