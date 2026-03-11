import { describe, it, expect } from 'vitest'
import { UPSCALE_MODEL } from '@/lib/models'

describe('UPSCALE_MODEL Constant', () => {
  it('should export UPSCALE_MODEL as "nightmareai/real-esrgan"', () => {
    expect(UPSCALE_MODEL).toBe('nightmareai/real-esrgan')
  })

  it('should have type string for UPSCALE_MODEL', () => {
    expect(typeof UPSCALE_MODEL).toBe('string')
  })
})
