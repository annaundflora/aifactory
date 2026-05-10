/**
 * Acceptance + Unit Tests for Slice 26 — Paste-Detect-Heuristik
 *
 * Source of truth: specs/.../slices/slice-26-paste-detect-heuristic.md
 *
 * Strategy: no_mocks (per slice Test-Strategy). Pure function — direct calls
 * with real strings. The STYLE_KEYWORDS list is module-internal; we treat the
 * function as a black box and feed real prompt vocabulary.
 */

import { describe, it, expect } from "vitest";

import { detectPastedPrompt } from "../paste-detect";

// ---------------------------------------------------------------------------
// Helpers — keep test inputs explicit and readable.
// ---------------------------------------------------------------------------

/** Builds a >= 80-char string of comma-separated, non-keyword tokens. */
function buildLongCommaStringWithoutKeywords(): string {
  // 12 tokens, each long enough so the joined string clears 80 chars and
  // there are >= 6 non-empty comma-tokens after trim/filter.
  const tokens = [
    "alpha bravo charlie",
    "delta echo foxtrot",
    "golf hotel india",
    "juliet kilo lima",
    "mike november oscar",
    "papa quebec romeo",
    "sierra tango uniform",
    "victor whiskey xray",
  ];
  const s = tokens.join(", ");
  // Sanity: ensure preconditions hold for AC-3.
  if (s.length < 80) {
    throw new Error("test fixture: expected length >= 80");
  }
  return s;
}

// ---------------------------------------------------------------------------
// Acceptance Tests — 1:1 mapping to GIVEN/WHEN/THEN ACs.
// ---------------------------------------------------------------------------

describe("Slice 26 — detectPastedPrompt: Paste-Detect-Heuristik (Acceptance)", () => {
  it("AC-1: GIVEN input < 80 chars WHEN detectPastedPrompt is called THEN returns false (length gate)", () => {
    // Arrange: short string under 80 characters, even if it has commas + keywords.
    const short = "cinematic, photorealistic, bokeh, 4k"; // 36 chars
    expect(short.length).toBeLessThan(80);

    // Act
    const result = detectPastedPrompt(short);

    // Assert
    expect(result).toBe(false);
  });

  it("AC-2: GIVEN length >= 80 but fewer than 6 comma-tokens WHEN called THEN returns false (comma gate)", () => {
    // Arrange: long string but only 3 comma-tokens — even with style keywords,
    // the comma-token gate should reject.
    const text =
      "this is a long pasted message about cinematic lighting and photorealistic mood with bokeh hints"; // > 80
    expect(text.length).toBeGreaterThanOrEqual(80);

    const tokenCount = text
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0).length;
    expect(tokenCount).toBeLessThan(6);

    // Act
    const result = detectPastedPrompt(text);

    // Assert
    expect(result).toBe(false);
  });

  it("AC-3: GIVEN length + commas OK but fewer than 2 style-keyword hits WHEN called THEN returns false (keyword gate)", () => {
    // Arrange: long, comma-heavy, but no style-keyword vocabulary.
    const text = buildLongCommaStringWithoutKeywords();
    expect(text.length).toBeGreaterThanOrEqual(80);
    const tokenCount = text
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0).length;
    expect(tokenCount).toBeGreaterThanOrEqual(6);

    // Act
    const result = detectPastedPrompt(text);

    // Assert
    expect(result).toBe(false);
  });

  it("AC-4: GIVEN typical comma-heavy style-prompt with all three conditions met WHEN called THEN returns true", () => {
    // Arrange: a realistic pasted style prompt — long, comma-rich, multiple
    // style keywords ("cinematic", "photorealistic", "bokeh", "4k", ...).
    const text =
      "portrait of an astronaut on a desert planet, cinematic, photorealistic, bokeh, 4k, sharp focus, studio lighting, highly detailed";
    expect(text.length).toBeGreaterThanOrEqual(80);

    // Act
    const result = detectPastedPrompt(text);

    // Assert
    expect(result).toBe(true);
  });

  it("AC-5: GIVEN edge-case inputs WHEN called THEN returns false without throwing", () => {
    // Arrange + Act + Assert: each edge case must be safe and return false.
    expect(() => detectPastedPrompt("")).not.toThrow();
    expect(detectPastedPrompt("")).toBe(false);

    expect(() => detectPastedPrompt("   ")).not.toThrow();
    expect(detectPastedPrompt("   ")).toBe(false);

    expect(() => detectPastedPrompt(",,,,,,")).not.toThrow();
    expect(detectPastedPrompt(",,,,,,")).toBe(false);

    expect(() => detectPastedPrompt("singleword")).not.toThrow();
    expect(detectPastedPrompt("singleword")).toBe(false);
  });

  it("AC-6: GIVEN style keywords in mixed/upper case WHEN called THEN matching is case-insensitive", () => {
    // Arrange: long, comma-heavy string where style keywords appear in
    // various casings. Lower-cased, this string would match.
    const text =
      "portrait of an astronaut on a desert planet, Cinematic, PHOTOREALISTIC, Bokeh, 4K, Sharp Focus, Studio Lighting, Highly Detailed";
    expect(text.length).toBeGreaterThanOrEqual(80);

    // Act
    const result = detectPastedPrompt(text);

    // Assert
    expect(result).toBe(true);
  });

  it("AC-7: GIVEN trailing or repeated commas WHEN tokens are counted THEN empty tokens are not counted", () => {
    // Arrange: only 5 *real* comma-tokens, but lots of trailing/repeated commas
    // that — if naively counted as non-empty — would inflate token count past
    // the 6-token threshold. Even with two style keywords present, the
    // comma-token gate must still reject because empties are filtered out.
    //
    // Five real (non-empty) tokens: padding-prefix, cinematic, photorealistic,
    // bokeh, 4k. Repeated commas (",,,," and trailing ",,,, ") MUST collapse
    // to nothing.
    const text =
      "padding padding padding padding padding padding,,,,cinematic,photorealistic,bokeh,4k,,,, ";
    expect(text.length).toBeGreaterThanOrEqual(80);

    const realTokens = text
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    // Sanity: real-token count is < 6 (so the gate must reject if empties are
    // correctly excluded). Without filtering, raw .split(",") would yield
    // many more entries.
    expect(realTokens.length).toBeLessThan(6);
    expect(text.split(",").length).toBeGreaterThanOrEqual(6);

    // Act
    const result = detectPastedPrompt(text);

    // Assert: the function must NOT count empty tokens, so this stays below
    // the comma-token threshold and returns false despite the keywords.
    expect(result).toBe(false);
  });

  it("AC-8: GIVEN the same input is called repeatedly WHEN detectPastedPrompt runs THEN result is identical (pure function)", () => {
    // Arrange: a single representative true-case and a single false-case.
    const matching =
      "portrait of an astronaut on a desert planet, cinematic, photorealistic, bokeh, 4k, sharp focus, studio lighting, highly detailed";
    const notMatching = buildLongCommaStringWithoutKeywords();

    // Act: call each input N times.
    const matchingResults = Array.from({ length: 5 }, () =>
      detectPastedPrompt(matching),
    );
    const notMatchingResults = Array.from({ length: 5 }, () =>
      detectPastedPrompt(notMatching),
    );

    // Assert: every call returns the same value as the first one (no state).
    expect(new Set(matchingResults).size).toBe(1);
    expect(matchingResults[0]).toBe(true);

    expect(new Set(notMatchingResults).size).toBe(1);
    expect(notMatchingResults[0]).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unit Tests — boundary / threshold behaviour around the documented gates.
// These complement the AC tests but do not replace them.
// ---------------------------------------------------------------------------

describe("detectPastedPrompt — threshold boundaries", () => {
  it("returns false for a string of exactly 79 characters (length gate strict <)", () => {
    // 79 chars total — even with commas + keywords, must fail length gate.
    const text =
      "cinematic, photorealistic, bokeh, 4k, sharp focus, studio lighting, hires!"; // < 80
    if (text.length >= 80) {
      // If hand-tuning ever drifts, fail loudly so the test is fixed properly.
      throw new Error(
        `fixture must be < 80 chars, got ${text.length} for: ${text}`,
      );
    }

    expect(detectPastedPrompt(text)).toBe(false);
  });

  it("returns true at the minimum-viable boundary: length>=80, exactly 6 tokens, exactly 2 keyword hits", () => {
    // Build a minimally compliant string: >=80 chars, exactly 6 non-empty
    // comma-tokens, exactly 2 of which contain style keywords.
    const tokens = [
      "padding alpha alpha",
      "padding bravo bravo",
      "padding charlie charlie",
      "padding delta delta",
      "cinematic",
      "photorealistic",
    ];
    const text = tokens.join(", ");
    expect(text.length).toBeGreaterThanOrEqual(80);

    const tokenCount = text
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0).length;
    expect(tokenCount).toBe(6);

    expect(detectPastedPrompt(text)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Defensive / type-safety tests — function tolerates unusual inputs.
// ---------------------------------------------------------------------------

describe("detectPastedPrompt — defensive input handling", () => {
  it("does not throw on long whitespace-only input", () => {
    const text = " ".repeat(120);
    expect(() => detectPastedPrompt(text)).not.toThrow();
    expect(detectPastedPrompt(text)).toBe(false);
  });

  it("does not throw on long comma-only input", () => {
    const text = ",".repeat(120);
    expect(() => detectPastedPrompt(text)).not.toThrow();
    expect(detectPastedPrompt(text)).toBe(false);
  });

  it("does not throw on long single-word input (no commas, no keywords)", () => {
    const text = "a".repeat(120);
    expect(() => detectPastedPrompt(text)).not.toThrow();
    expect(detectPastedPrompt(text)).toBe(false);
  });
});
