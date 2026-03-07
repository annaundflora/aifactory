import { describe, it, expect } from "vitest"
import {
  BUILDER_CATEGORIES,
  type BuilderFragment,
  type BuilderCategory,
} from "../builder-fragments"

describe("Builder Fragments Config", () => {
  // AC-1: GIVEN die Config-Datei `lib/builder-fragments.ts`
  //       WHEN sie importiert wird
  //       THEN exportiert sie ein Array `BUILDER_CATEGORIES` vom Typ `BuilderCategory[]` mit exakt 5 Eintraegen
  it("AC-1: should export BUILDER_CATEGORIES array with exactly 5 categories", () => {
    expect(BUILDER_CATEGORIES).toBeDefined()
    expect(Array.isArray(BUILDER_CATEGORIES)).toBe(true)
    expect(BUILDER_CATEGORIES).toHaveLength(5)
  })

  // AC-2: GIVEN das `BUILDER_CATEGORIES` Array
  //       WHEN ueber die Kategorie-IDs iteriert wird
  //       THEN enthaelt es genau die IDs `["style", "colors", "composition", "lighting", "mood"]` in dieser Reihenfolge
  it('AC-2: should contain category IDs ["style", "colors", "composition", "lighting", "mood"] in order', () => {
    const ids = BUILDER_CATEGORIES.map((cat) => cat.id)
    expect(ids).toEqual(["style", "colors", "composition", "lighting", "mood"])
  })

  // AC-3: GIVEN jede `BuilderCategory`
  //       WHEN deren `fragments` Array geprueft wird
  //       THEN enthaelt die Kategorie "style" genau 9 Fragmente, "colors" genau 9 Fragmente,
  //            "composition" genau 6 Fragmente, "lighting" genau 6 Fragmente, "mood" genau 6 Fragmente
  it("AC-3: should have 9 style, 9 colors, 6 composition, 6 lighting, 6 mood fragments", () => {
    const expectedCounts: Record<string, number> = {
      style: 9,
      colors: 9,
      composition: 6,
      lighting: 6,
      mood: 6,
    }

    for (const category of BUILDER_CATEGORIES) {
      const expected = expectedCounts[category.id]
      expect(
        category.fragments,
        `Category "${category.id}" should have ${expected} fragments but has ${category.fragments.length}`
      ).toHaveLength(expected)
    }
  })

  // AC-4: GIVEN jedes `BuilderFragment` in allen Kategorien
  //       WHEN dessen Felder geprueft werden
  //       THEN hat es eine nicht-leere `id` (string), ein nicht-leeres `label` (string)
  //            und einen nicht-leeren `fragment` (string mit mindestens 20 Zeichen)
  it("AC-4: should have non-empty id, label, and fragment (min 20 chars) for every fragment", () => {
    for (const category of BUILDER_CATEGORIES) {
      for (const frag of category.fragments) {
        expect(
          typeof frag.id,
          `Fragment in "${category.id}" should have id of type string`
        ).toBe("string")
        expect(
          frag.id.length,
          `Fragment in "${category.id}" has empty id`
        ).toBeGreaterThan(0)

        expect(
          typeof frag.label,
          `Fragment "${frag.id}" should have label of type string`
        ).toBe("string")
        expect(
          frag.label.length,
          `Fragment "${frag.id}" has empty label`
        ).toBeGreaterThan(0)

        expect(
          typeof frag.fragment,
          `Fragment "${frag.id}" should have fragment of type string`
        ).toBe("string")
        expect(
          frag.fragment.length,
          `Fragment "${frag.id}" fragment text should be at least 20 characters but is ${frag.fragment.length}`
        ).toBeGreaterThanOrEqual(20)
      }
    }
  })

  // AC-5: GIVEN alle Fragment-IDs ueber alle Kategorien hinweg
  //       WHEN auf Eindeutigkeit geprueft wird
  //       THEN sind alle IDs global eindeutig (keine Duplikate)
  it("AC-5: should have globally unique fragment IDs across all categories", () => {
    const allIds = BUILDER_CATEGORIES.flatMap((cat) =>
      cat.fragments.map((frag) => frag.id)
    )
    const uniqueIds = new Set(allIds)
    expect(
      uniqueIds.size,
      `Expected ${allIds.length} unique IDs but found ${uniqueIds.size}. Duplicates: ${allIds.filter((id, i) => allIds.indexOf(id) !== i).join(", ")}`
    ).toBe(allIds.length)
  })

  // AC-6: GIVEN jedes Fragment
  //       WHEN dessen `fragment`-Text geprueft wird
  //       THEN ist der Text ein ausformulierter Prompt-Satzteil (keine einzelnen Woerter),
  //            der direkt als Stil-Modifier in einem Bild-Prompt verwendbar ist
  it("AC-6: should have articulated prompt fragments containing spaces (not single words)", () => {
    for (const category of BUILDER_CATEGORIES) {
      for (const frag of category.fragments) {
        const wordCount = frag.fragment.trim().split(/\s+/).length
        expect(
          frag.fragment.includes(" "),
          `Fragment "${frag.id}" should contain spaces (is a phrase, not a single word): "${frag.fragment}"`
        ).toBe(true)
        expect(
          wordCount,
          `Fragment "${frag.id}" should be an articulated phrase with multiple words but has only ${wordCount} word(s)`
        ).toBeGreaterThanOrEqual(3)
      }
    }
  })

  // AC-7: GIVEN die exportierten Typen `BuilderFragment` und `BuilderCategory`
  //       WHEN sie in einer anderen Datei importiert werden
  //       THEN sind beide Typen verfuegbar und entsprechen der Struktur
  it("AC-7: should export BuilderFragment and BuilderCategory types with correct structure", () => {
    // Verify type structure at runtime by checking that actual data conforms
    // to the expected shape. TypeScript compile-time check is implicit via the import.
    const firstCategory: BuilderCategory = BUILDER_CATEGORIES[0]
    expect(firstCategory).toHaveProperty("id")
    expect(firstCategory).toHaveProperty("label")
    expect(firstCategory).toHaveProperty("fragments")

    const firstFragment: BuilderFragment = firstCategory.fragments[0]
    expect(firstFragment).toHaveProperty("id")
    expect(firstFragment).toHaveProperty("label")
    expect(firstFragment).toHaveProperty("fragment")

    // Verify these are the only expected keys (no extra properties)
    expect(Object.keys(firstFragment).sort()).toEqual(
      ["fragment", "id", "label"]
    )
    expect(Object.keys(firstCategory).sort()).toEqual(
      ["fragments", "id", "label"]
    )
  })
})
