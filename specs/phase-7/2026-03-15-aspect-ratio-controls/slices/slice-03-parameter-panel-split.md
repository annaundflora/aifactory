# Slice 3: ParameterPanel Primary/Advanced Split

> **Slice 3 von 4** fuer `Model Parameter Controls (Aspect Ratio, Size & Advanced)`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-03-parameter-panel-split` |
| **Test** | `pnpm test components/workspace/parameter-panel.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-use-model-schema-hook"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/parameter-panel.test.tsx` |
| **Integration Command** | n/a |
| **Acceptance Command** | `pnpm tsc --noEmit` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | n/a |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Die bestehende `ParameterPanel`-Komponente um Primary/Advanced-Aufteilung, erweiterte Feld-Ausschlussliste und Aspect-Ratio-Gruppierung erweitern. Danach rendert das Panel Primary-Fields (aspect_ratio, megapixels, resolution) immer sichtbar, Advanced-Fields in einem Collapsible-Bereich (default eingeklappt), und blendet interne/technische Felder komplett aus.

---

## Acceptance Criteria

1) GIVEN ein Schema mit den Properties `aspect_ratio` (enum), `megapixels` (enum), `quality` (enum) und `prompt` (string)
   WHEN `ParameterPanel` mit `primaryFields={["aspect_ratio", "megapixels", "resolution"]}` gerendert wird
   THEN sind `aspect_ratio` und `megapixels` im Primary-Bereich sichtbar (ausserhalb des Collapsible), `quality` ist NICHT sichtbar (Advanced ist eingeklappt), und `prompt` ist NICHT gerendert (INTERNAL_FIELDS)

2) GIVEN `ParameterPanel` zeigt den Advanced-Toggle-Button
   WHEN der User auf den Advanced-Toggle klickt
   THEN wird der Advanced-Bereich sichtbar und zeigt die Advanced-Fields (z.B. `quality`)

3) GIVEN ein Schema mit den Properties `prompt`, `negative_prompt`, `image`, `image_input`, `seed`, `num_outputs`, `openai_api_key`, `mask`, `prompt_strength`, `strength`
   WHEN `ParameterPanel` gerendert wird
   THEN wird KEINES dieser Fields gerendert (weder Primary noch Advanced) — alle sind in INTERNAL_FIELDS

4) GIVEN ein Schema mit `description` (`type: "string"`, kein enum), `disable_safety` (`type: "boolean"`), `input_images` (`type: "array"`, kein enum)
   WHEN `ParameterPanel` gerendert wird
   THEN werden diese drei Fields NICHT gerendert — Type-Filter schliesst `string` ohne enum, `boolean` und `array` ohne enum aus

5) GIVEN ein Schema mit `aspect_ratio` (enum mit 14 Werten: `1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9, 1:4, 4:1, 1:8, 8:1`)
   WHEN das `aspect_ratio`-Select-Dropdown geoeffnet wird
   THEN erscheinen zuerst die Common-Werte (`1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3`), dann ein visueller Separator, dann die restlichen Werte

6) GIVEN ein Schema mit `aspect_ratio` (enum mit 3 Werten: `1:1, 3:2, 2:3`)
   WHEN das `aspect_ratio`-Select-Dropdown geoeffnet wird
   THEN werden alle Werte ohne Separator angezeigt (Gruppierung nur bei >8 Werten)

7) GIVEN ein Schema mit NUR `quality` (enum) und `output_format` (enum) — keine Primary-Fields
   WHEN `ParameterPanel` mit `primaryFields={["aspect_ratio", "megapixels", "resolution"]}` gerendert wird
   THEN ist der Primary-Bereich leer, aber Advanced-Toggle und Advanced-Bereich existieren

8) GIVEN ein Schema mit NUR `aspect_ratio` (enum) — keine Advanced-Fields nach Filterung
   WHEN `ParameterPanel` gerendert wird
   THEN wird der Advanced-Toggle NICHT angezeigt

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/workspace/parameter-panel.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ParameterPanel – Primary/Advanced Split', () => {
  // AC-1: Primary-Fields sichtbar, Advanced eingeklappt, INTERNAL_FIELDS ausgeblendet
  it.todo('should render primary fields visibly and hide advanced fields when collapsed')

  // AC-2: Advanced-Bereich wird nach Toggle-Klick sichtbar
  it.todo('should show advanced fields after clicking the advanced toggle')

  // AC-3: INTERNAL_FIELDS (prompt, image, seed, num_outputs, etc.) nie gerendert
  it.todo('should not render any INTERNAL_FIELDS properties')

  // AC-4: Type-Filter schliesst string-ohne-enum, boolean und array-ohne-enum aus
  it.todo('should not render string-without-enum, boolean, or array-without-enum properties')

  // AC-5: Aspect-Ratio mit >8 Werten zeigt Separator zwischen Common und Extreme
  it.todo('should show separator between common and extreme aspect ratio values when >8 options')

  // AC-6: Aspect-Ratio mit <=8 Werten zeigt keinen Separator
  it.todo('should show all aspect ratio values without separator when <=8 options')

  // AC-7: Keine Primary-Fields im Schema → Primary-Bereich leer, Advanced-Toggle vorhanden
  it.todo('should show empty primary area and advanced toggle when schema has no primary fields')

  // AC-8: Keine Advanced-Fields → Advanced-Toggle versteckt
  it.todo('should hide advanced toggle when schema has no advanced fields')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-02 | `useModelSchema` | Hook | Nicht direkt importiert — Consumer-Slices (3+4 der Pipeline) verbinden Hook-Output mit ParameterPanel Props |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ParameterPanel` (erweitert) | Component | slice-03 Pipeline (Prompt Panel), slice-04 Pipeline (Canvas Popovers) | `ParameterPanel({ schema, isLoading, values, onChange, primaryFields? })` |
| `INTERNAL_FIELDS` | Set<string> | intern (nicht exportiert) | Ausschlussliste fuer interne Schema-Properties |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/parameter-panel.tsx` — MODIFY: `primaryFields` Prop hinzufuegen, INTERNAL_FIELDS erweitern, Type-Filter ergaenzen, Primary/Advanced-Rendering-Split mit Collapsible, Aspect-Ratio-Gruppierung bei >8 Enum-Werten
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice aendert NUR `parameter-panel.tsx` — keine Integration in Prompt Panel oder Canvas Popovers
- Kein neuer Hook oder Utility
- Keine neuen Server Actions oder API-Aenderungen
- `primaryFields` Prop ist optional — ohne Prop verhält sich das Panel abwaertskompatibel (alle Fields als flat list)

**Technische Constraints:**
- Collapsible aus bestehender shadcn/Radix-UI-Bibliothek verwenden (`@/components/ui/collapsible`)
- SelectSeparator aus bestehender shadcn Select-Bibliothek fuer Aspect-Ratio-Gruppierung verwenden
- INTERNAL_FIELDS als `Set<string>` — Common-Werte fuer Aspect-Ratio-Gruppierung als `Set<string>`
- `primaryFields` Prop-Typ: `string[]` (optionale Whitelist)
- Bestehende Props (`schema`, `isLoading`, `values`, `onChange`) bleiben unveraendert

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-15-aspect-ratio-controls/architecture.md` → Section "Migration Map > Existing Files Changed" (parameter-panel.tsx Zeile)
- Architecture: `specs/phase-7/2026-03-15-aspect-ratio-controls/architecture.md` → Section "Constraints & Integrations" (INTERNAL_FIELDS, Type-Filter, Aspect-Ratio-Gruppierung)
- Discovery: `specs/phase-7/2026-03-15-aspect-ratio-controls/discovery.md` → Section "Business Rules" (INTERNAL_FIELDS-Liste, Primary-Whitelist, Common-Aspekt-Ratios)
- Wireframes: `specs/phase-7/2026-03-15-aspect-ratio-controls/wireframes.md` → Section "Screen: Prompt Panel" (Layout-Kontext fuer Primary/Advanced Split)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/workspace/parameter-panel.tsx` | Bestehende Komponente erweitern — Struktur, Types, Helpers beibehalten |
| `components/ui/collapsible.tsx` | Import fuer Advanced-Section — NICHT neu bauen |
| `components/ui/select.tsx` | Bestehender Import, zusaetzlich `SelectSeparator` fuer Aspect-Ratio-Gruppierung |
