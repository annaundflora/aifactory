/**
 * Formats a numeric run count into a human-readable string.
 *
 * Thresholds:
 *   >= 1,000,000,000 → B
 *   >= 1,000,000     → M
 *   >= 1,000         → K
 *   otherwise        → plain number
 *
 * At most one decimal place; trailing zeros after the decimal are omitted.
 * Format: "{value}{unit} runs" (no space between value and unit)
 */
export function formatRunCount(count: number): string {
  if (count >= 1_000_000_000) {
    const value = count / 1_000_000_000;
    const formatted = parseFloat(value.toFixed(1));
    return `${formatted}B runs`;
  }

  if (count >= 1_000_000) {
    const value = count / 1_000_000;
    const formatted = parseFloat(value.toFixed(1));
    return `${formatted}M runs`;
  }

  if (count >= 1_000) {
    const value = count / 1_000;
    const formatted = parseFloat(value.toFixed(1));
    return `${formatted}K runs`;
  }

  return `${count} runs`;
}
