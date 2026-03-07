# Slice 09: Builder-Fragmente als Config definieren

> **Slice 9 von 9** für `quality-improvements`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-09-builder-fragments-config` |
| **Test** | `pnpm test lib/__tests__/builder-fragments.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/__tests__/builder-fragments.test.ts` |
| **Integration Command** | N/A |
| **Acceptance Command** | N/A |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | N/A |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Hardcoded Builder-Fragmente als TypeScript-Config bereitstellen. 5 Kategorien (Style, Colors, Composition, Lighting, Mood) mit je 6-9 ausformulierten Prompt-Fragmenten, die spaeter im Builder Drawer als Chips angezeigt und zu einem Stil-Text zusammengesetzt werden.

---

## Acceptance Criteria

1) GIVEN die Config-Datei `lib/builder-fragments.ts`
   WHEN sie importiert wird
   THEN exportiert sie ein Array `BUILDER_CATEGORIES` vom Typ `BuilderCategory[]` mit exakt 5 Eintraegen

2) GIVEN das `BUILDER_CATEGORIES` Array
   WHEN ueber die Kategorie-IDs iteriert wird
   THEN enthaelt es genau die IDs `["style", "colors", "composition", "lighting", "mood"]` in dieser Reihenfolge

3) GIVEN jede `BuilderCategory`
   WHEN deren `fragments` Array geprueft wird
   THEN enthaelt die Kategorie "style" genau 9 Fragmente, "colors" genau 9 Fragmente, "composition" genau 6 Fragmente, "lighting" genau 6 Fragmente, "mood" genau 6 Fragmente

4) GIVEN jedes `BuilderFragment` in allen Kategorien
   WHEN dessen Felder geprueft werden
   THEN hat es eine nicht-leere `id` (string), ein nicht-leeres `label` (string) und einen nicht-leeren `fragment` (string mit mindestens 20 Zeichen)

5) GIVEN alle Fragment-IDs ueber alle Kategorien hinweg
   WHEN auf Eindeutigkeit geprueft wird
   THEN sind alle IDs global eindeutig (keine Duplikate)

6) GIVEN jedes Fragment
   WHEN dessen `fragment`-Text geprueft wird
   THEN ist der Text ein ausformulierter Prompt-Satzteil (keine einzelnen Woerter), der direkt als Stil-Modifier in einem Bild-Prompt verwendbar ist

7) GIVEN die exportierten Typen `BuilderFragment` und `BuilderCategory`
   WHEN sie in einer anderen Datei importiert werden
   THEN sind beide Typen verfuegbar und entsprechen der Struktur aus architecture.md Section "Builder Fragments Architecture"

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/__tests__/builder-fragments.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Builder Fragments Config', () => {
  // AC-1: Export BUILDER_CATEGORIES mit 5 Eintraegen
  it.todo('should export BUILDER_CATEGORIES array with exactly 5 categories')

  // AC-2: Kategorie-IDs in korrekter Reihenfolge
  it.todo('should contain category IDs style, colors, composition, lighting, mood in order')

  // AC-3: Korrekte Anzahl Fragmente pro Kategorie
  it.todo('should have 9 style, 9 colors, 6 composition, 6 lighting, 6 mood fragments')

  // AC-4: Fragment-Felder nicht leer und fragment mindestens 20 Zeichen
  it.todo('should have non-empty id, label, and fragment (min 20 chars) for every fragment')

  // AC-5: Globale Eindeutigkeit der Fragment-IDs
  it.todo('should have globally unique fragment IDs across all categories')

  // AC-6: Fragmente sind ausformulierte Satzteile
  it.todo('should have articulated prompt fragments containing spaces (not single words)')

  // AC-7: Typen BuilderFragment und BuilderCategory exportiert
  it.todo('should export BuilderFragment and BuilderCategory types')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| -- | -- | -- | Keine Abhaengigkeiten |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `BUILDER_CATEGORIES` | Exported constant | Builder Drawer (Slice 03) | `BuilderCategory[]` |
| `BuilderFragment` | TypeScript Type | Builder Drawer (Slice 03) | `{ id: string; label: string; fragment: string }` |
| `BuilderCategory` | TypeScript Type | Builder Drawer (Slice 03) | `{ id: string; label: string; fragments: BuilderFragment[] }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/builder-fragments.ts` — TypeScript-Typen (BuilderFragment, BuilderCategory) und BUILDER_CATEGORIES Constant mit 5 Kategorien und 36 ausformulierten Fragmenten
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice erstellt NUR die Config-Datei, KEINE UI-Komponenten
- Kein Builder Drawer, keine Chip-Komponenten, keine Preview-Logik
- Keine "My Snippets" Tab-Logik (bleibt in Slice 03)

**Technische Constraints:**
- Fragmente sind reine Daten (hardcoded), keine Laufzeit-Generierung
- Jedes Fragment muss als Stil-Modifier direkt an einen Prompt anhaengbar sein (z.B. "rendered as a classical oil painting with visible brushstrokes, rich impasto texture, and dramatic chiaroscuro lighting")
- Kategorien und Fragmente muessen die Beispiele aus architecture.md Section "Builder Fragments Architecture" als Qualitaets-Referenz verwenden
- Fragment-Zusammensetzung ueber Kategorien hinweg erfolgt mit ", " Separator (siehe architecture.md Section "Fragment Composition")

**Referenzen:**
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` → Section "Builder Fragments Architecture" (Typen, Kategorien, Beispiel-Fragmente)
- Discovery: `specs/phase-1/2026-03-07-quality-improvements/discovery.md` → Section "Prompt Builder Fragmente" (Kategorie-Anforderungen)
