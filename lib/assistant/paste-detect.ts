/**
 * Paste-Detect Heuristic (Frontend-pure)
 *
 * Detects whether a raw user-message string looks like a fully-formed pasted
 * image-prompt (typical comma-heavy "style prompt" with descriptive vocabulary).
 *
 * Used by Slice 27 (Paste-Detect-Confirm-Card) to decide whether to surface a
 * confirmation card on the user's first message in a session. The decision of
 * "is this the first message" lives in the caller, NOT in this heuristic.
 *
 * Match conditions (all three required):
 *   1. length         >= 80 characters
 *   2. comma-tokens   >= 6 (non-empty after trim)
 *   3. style-keyword  >= 2 hits (case-insensitive)
 *
 * Reference: architecture.md → "Paste-Detect Heuristic (Frontend)" (Q&A 9).
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Curated list of vocabulary commonly found in pasted image-prompts.
 * Match is case-insensitive (input is lowercased before comparison).
 *
 * Module-internal — NOT exported. Tests treat it as a black box and feed real
 * prompt strings rather than asserting against this list.
 */
const STYLE_KEYWORDS: readonly string[] = [
  "cinematic",
  "photorealistic",
  "hyperreal",
  "hyperrealistic",
  "bokeh",
  "4k",
  "8k",
  "sharp focus",
  "studio lighting",
  "soft lighting",
  "rim lighting",
  "volumetric",
  "volumetric lighting",
  "concept art",
  "octane render",
  "unreal engine",
  "depth of field",
  "ultra detailed",
  "highly detailed",
  "intricate details",
  "masterpiece",
  "trending on artstation",
  "wide angle",
  "macro shot",
  "golden hour",
  "dramatic lighting",
  "ambient occlusion",
  "ray tracing",
  "high resolution",
  "film grain",
];

const MIN_LENGTH = 80;
const MIN_COMMA_TOKENS = 6;
const MIN_KEYWORD_HITS = 2;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Pure heuristic — returns `true` if `text` looks like a fully-formed pasted
 * image-prompt, `false` otherwise.
 *
 * Deterministic, no side-effects, no I/O.
 *
 * @param text - Raw user-message string (any input is tolerated; never throws).
 * @returns `true` iff length, comma-token-count, and style-keyword-hit-count
 *          all meet their thresholds; `false` for any malformed/edge input.
 */
export function detectPastedPrompt(text: string): boolean {
  // Defensive: tolerate non-string inputs without throwing.
  if (typeof text !== "string" || text.length === 0) {
    return false;
  }

  // AC-1: length gate (early-exit).
  if (text.length < MIN_LENGTH) {
    return false;
  }

  // AC-2 / AC-7: comma-token gate. Split, trim, drop empties, then count.
  const commaTokens = text
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (commaTokens.length < MIN_COMMA_TOKENS) {
    return false;
  }

  // AC-3 / AC-6: style-keyword gate. Case-insensitive substring match against
  // the curated list. Each keyword counts at most once, regardless of how
  // often it occurs.
  const haystack = text.toLowerCase();
  let keywordHits = 0;
  for (const keyword of STYLE_KEYWORDS) {
    if (haystack.includes(keyword)) {
      keywordHits += 1;
      if (keywordHits >= MIN_KEYWORD_HITS) {
        // Early-exit: we already know it's a match.
        return true;
      }
    }
  }

  return false;
}
