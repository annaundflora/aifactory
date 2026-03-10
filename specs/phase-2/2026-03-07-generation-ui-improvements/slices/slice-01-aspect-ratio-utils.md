# Slice 01: Aspect Ratio Utils

> **Slice 01 von 5** fuer `Generation UI Improvements`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-01-aspect-ratio-utils` |
| **Test** | `pnpm test lib/aspect-ratio.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/aspect-ratio.test.ts` |
| **Integration Command** | `pnpm test lib/aspect-ratio.test.ts` |
| **Acceptance Command** | `pnpm test lib/aspect-ratio.test.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Pure-function-Bibliothek, die Model-Schemas nach Aspect-Ratio-Unterstuetzung analysiert, Pixel-Dimensionen berechnet und Custom-Ratios validiert. Bildet die rechnerische Grundlage fuer Aspect-Ratio-Chips und Size-Chips in den nachfolgenden UI-Slices.

---

## Acceptance Criteria

1) GIVEN ein Model-Schema mit `aspect_ratio`-Property vom Typ `enum` (z.B. Werte `["1:1", "16:9", "9:16"]`)
   WHEN `parseRatioConfig(schema)` aufgerufen wird
   THEN gibt die Funktion `{ mapping: 'enum', availableRatios: ["1:1", "16:9", "9:16"] }` zurueck

2) GIVEN ein Model-Schema mit `width`- und `height`-Properties (integer, mit `minimum`/`maximum`)
   WHEN `parseRatioConfig(schema)` aufgerufen wird
   THEN gibt die Funktion `{ mapping: 'pixels', minWidth, maxWidth, minHeight, maxHeight }` zurueck mit den Werten aus dem Schema

3) GIVEN ein Model-Schema ohne `aspect_ratio`, `width` und `height` Properties
   WHEN `parseRatioConfig(schema)` aufgerufen wird
   THEN gibt die Funktion `{ mapping: 'none', availableRatios: [] }` zurueck

4) GIVEN ratio `"16:9"` und sizeValue `1024`
   WHEN `calculateDimensions("16:9", 1024)` aufgerufen wird
   THEN gibt die Funktion `{ width: 1024, height: 576 }` zurueck (laengste Kante = 1024, kuerzere Kante auf naechste gerade Zahl gerundet)

5) GIVEN ratio `"9:16"` und sizeValue `1024`
   WHEN `calculateDimensions("9:16", 1024)` aufgerufen wird
   THEN gibt die Funktion `{ width: 576, height: 1024 }` zurueck (Hochformat: Hoehe = laengste Kante)

6) GIVEN ratio `"1:1"` und sizeValue `768`
   WHEN `calculateDimensions("1:1", 768)` aufgerufen wird
   THEN gibt die Funktion `{ width: 768, height: 768 }` zurueck

7) GIVEN Custom-Ratio-String `"21:9"`
   WHEN `validateCustomRatio("21:9")` aufgerufen wird
   THEN gibt die Funktion `{ valid: true }` zurueck

8) GIVEN Custom-Ratio-String `"0:9"` (Nullwert)
   WHEN `validateCustomRatio("0:9")` aufgerufen wird
   THEN gibt die Funktion `{ valid: false, error: "Ungueltiges Format (z.B. 21:9)" }` zurueck

9) GIVEN Custom-Ratio-String `"21:2"` mit Verhaeltnis > 10:1 (10.5:1)
   WHEN `validateCustomRatio("21:2")` aufgerufen wird
   THEN gibt die Funktion `{ valid: false, error: "Verhaeltnis darf max 10:1 sein" }` zurueck

10) GIVEN Custom-Ratio-String `"abc:9"` oder `"16-9"` (falsches Format)
    WHEN `validateCustomRatio("abc:9")` aufgerufen wird
    THEN gibt die Funktion `{ valid: false, error: "Ungueltiges Format (z.B. 21:9)" }` zurueck

11) GIVEN `SIZE_PRESETS`-Export
    WHEN der Wert inspiziert wird
    THEN enthaelt er genau: `{ xs: 512, s: 768, m: 1024, l: 1536, xl: 2048 }`

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/aspect-ratio.test.ts`

<test_spec>
```typescript
// AC-1: parseRatioConfig — enum-Schema
it.todo('should return mapping enum with availableRatios for aspect_ratio enum schema')

// AC-2: parseRatioConfig — width/height-Schema
it.todo('should return mapping pixels with min/max constraints for width/height schema')

// AC-3: parseRatioConfig — kein Ratio-Support
it.todo('should return mapping none with empty availableRatios for schema without ratio support')

// AC-4: calculateDimensions — Querformat
it.todo('should return width 1024 height 576 for ratio 16:9 and sizeValue 1024')

// AC-5: calculateDimensions — Hochformat
it.todo('should return width 576 height 1024 for ratio 9:16 and sizeValue 1024')

// AC-6: calculateDimensions — quadratisch
it.todo('should return equal width and height for ratio 1:1')

// AC-7: validateCustomRatio — gueltig
it.todo('should return valid true for well-formed ratio string 21:9')

// AC-8: validateCustomRatio — Nullwert
it.todo('should return valid false with format error for ratio 0:9')

// AC-9: validateCustomRatio — Verhaeltnis ueberschreitet 10:1
it.todo('should return valid false with max-ratio error for ratio 21:2')

// AC-10: validateCustomRatio — falsches Format
it.todo('should return valid false with format error for non-numeric ratio string')

// AC-11: SIZE_PRESETS — Vollstaendigkeit
it.todo('should export SIZE_PRESETS with exactly xs=512 s=768 m=1024 l=1536 xl=2048')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| (keine) | — | — | — |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `parseRatioConfig` | Function | slice-02 (AspectRatioChips), slice-03 (PromptArea) | `(schema: SchemaProperties) => RatioConfig` |
| `calculateDimensions` | Function | slice-02 (SizeChips), slice-03 (Generate-Flow) | `(ratio: string, sizeValue: number) => { width: number; height: number }` |
| `validateCustomRatio` | Function | slice-02 (CustomRatioInput) | `(input: string) => { valid: boolean; error?: string }` |
| `SIZE_PRESETS` | Const | slice-02 (SizeChips) | `Record<'xs' \| 's' \| 'm' \| 'l' \| 'xl', number>` |
| `RatioConfig` | Type | slice-02, slice-03 | `{ mapping: 'enum' \| 'pixels' \| 'none'; availableRatios: string[]; minWidth?: number; maxWidth?: number; minHeight?: number; maxHeight?: number }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/aspect-ratio.ts` — Pure-function-Bibliothek: `parseRatioConfig`, `calculateDimensions`, `validateCustomRatio`, `SIZE_PRESETS`, `RatioConfig`-Type
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Kein React-Code, keine Komponenten, keine UI-Logik
- Kein Zugriff auf Model-Registry oder Replicate API — Schema wird als Parameter uebergeben
- Kein Persistieren von Zustand

**Technische Constraints:**
- Nur pure functions und Konstanten — kein Side-Effect-Code
- `SchemaProperties` entspricht dem OpenAPI-Schema-Format der Replicate API (siehe architecture.md -> Constraints & Integrations -> Replicate API)
- `calculateDimensions`: Kuerzere Kante wird auf die naechste **gerade** Zahl gerundet (`Math.round(x / 2) * 2`)
- `validateCustomRatio`: Regex-Pattern und Grenzwerte gemaess architecture.md -> Validation Rules (max 10:1, beide Seiten > 0)

**Referenzen:**
- Architecture: `specs/phase-2/2026-03-07-generation-ui-improvements/architecture.md` -> Server Logic (AspectRatioService, SizeCalculator), Validation Rules, Aspect Ratio Schema Parsing (Component Architecture)
- Discovery: `specs/phase-2/2026-03-07-generation-ui-improvements/discovery.md` -> Business Rules (Size-Berechnung, Custom Ratio, Aspect Ratio Mapping)
