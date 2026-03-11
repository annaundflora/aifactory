import { formatRunCount } from '../format-run-count'

describe('formatRunCount', () => {
  /**
   * AC-1: GIVEN count = 0
   * WHEN formatRunCount(0) is called
   * THEN it returns the string "0 runs"
   */
  it('should return "0 runs" for count 0', () => {
    const result = formatRunCount(0)
    expect(result).toBe('0 runs')
  })

  /**
   * AC-2: GIVEN count = 999 (below the thousand threshold)
   * WHEN formatRunCount(999) is called
   * THEN it returns the string "999 runs"
   */
  it('should return "999 runs" for count 999', () => {
    const result = formatRunCount(999)
    expect(result).toBe('999 runs')
  })

  /**
   * AC-3: GIVEN count = 1000 (exactly at the thousand threshold)
   * WHEN formatRunCount(1000) is called
   * THEN it returns the string "1K runs"
   */
  it('should return "1K runs" for count 1000', () => {
    const result = formatRunCount(1000)
    expect(result).toBe('1K runs')
  })

  /**
   * AC-4: GIVEN count = 1500 (thousands with decimal place)
   * WHEN formatRunCount(1500) is called
   * THEN it returns the string "1.5K runs"
   */
  it('should return "1.5K runs" for count 1500', () => {
    const result = formatRunCount(1500)
    expect(result).toBe('1.5K runs')
  })

  /**
   * AC-5: GIVEN count = 150000 (six digits without significant decimal)
   * WHEN formatRunCount(150000) is called
   * THEN it returns the string "150K runs"
   */
  it('should return "150K runs" for count 150000', () => {
    const result = formatRunCount(150000)
    expect(result).toBe('150K runs')
  })

  /**
   * AC-6: GIVEN count = 1000000 (exactly at the million threshold)
   * WHEN formatRunCount(1000000) is called
   * THEN it returns the string "1M runs"
   */
  it('should return "1M runs" for count 1000000', () => {
    const result = formatRunCount(1000000)
    expect(result).toBe('1M runs')
  })

  /**
   * AC-7: GIVEN count = 2300000 (millions with decimal place)
   * WHEN formatRunCount(2300000) is called
   * THEN it returns the string "2.3M runs"
   */
  it('should return "2.3M runs" for count 2300000', () => {
    const result = formatRunCount(2300000)
    expect(result).toBe('2.3M runs')
  })

  /**
   * AC-8: GIVEN count = 1000000000 (billion)
   * WHEN formatRunCount(1000000000) is called
   * THEN it returns the string "1B runs"
   */
  it('should return "1B runs" for count 1000000000', () => {
    const result = formatRunCount(1000000000)
    expect(result).toBe('1B runs')
  })

  /**
   * AC-9: GIVEN a rounded value that has trailing zero decimals (e.g. count = 2000000)
   * WHEN formatRunCount(2000000) is called
   * THEN it returns "2M runs" (NOT "2.0M runs")
   */
  it('should return "2M runs" (not "2.0M runs") for count 2000000', () => {
    const result = formatRunCount(2000000)
    expect(result).toBe('2M runs')
    expect(result).not.toBe('2.0M runs')
  })
})
