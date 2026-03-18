# Slice 8: Types & Seed Update (GenerationMode + TIERS_BY_MODE + Seed 9 Rows)

> **Slice 8 von 12** fuer `Model Catalog`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-08-types-seed` |
| **Test** | `pnpm test lib/__tests__/types.test.ts components/settings/__tests__/model-mode-section.test.ts lib/db/__tests__/queries-seed.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-06-server-actions", "slice-07-service-replace"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/__tests__/types.test.ts components/settings/__tests__/model-mode-section.test.ts lib/db/__tests__/queries-seed.test.ts` |
| **Integration Command** | -- (reine Typ-/Konstanten-Aenderungen, kein externer Service) |
| **Acceptance Command** | `pnpm tsc --noEmit` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (DB-Modul fuer Seed-Tests mocken) |

---

## Ziel

`GenerationMode` um `"inpaint"` und `"outpaint"` erweitern, die bestehenden fehlerhaften Tier-Zuordnungen in `TIERS_BY_MODE` korrigieren (img2img: kein max, upscale: quality/max statt draft/quality), Labels fuer 5 Modes bereitstellen, und die Seed-Funktion auf 9 korrekte Rows aktualisieren. Dieses Slice ist Voraussetzung fuer alle UI-Slices die 5 Modes rendern.

---

## Acceptance Criteria

1) GIVEN `lib/types.ts`
   WHEN der Type `GenerationMode` geprueft wird
   THEN akzeptiert er exakt die 5 Werte `"txt2img" | "img2img" | "upscale" | "inpaint" | "outpaint"`

2) GIVEN `lib/types.ts`
   WHEN das Array `VALID_GENERATION_MODES` geprueft wird
   THEN enthaelt es exakt `["txt2img", "img2img", "upscale", "inpaint", "outpaint"]` (5 Eintraege, Reihenfolge beibehalten)

3) GIVEN `model-mode-section.tsx`
   WHEN `MODE_LABELS` fuer alle 5 GenerationMode-Keys abgefragt wird
   THEN gibt es Eintraege: `txt2img: "TEXT TO IMAGE"`, `img2img: "IMAGE TO IMAGE"`, `upscale: "UPSCALE"`, `inpaint: "INPAINT"`, `outpaint: "OUTPAINT"`

4) GIVEN `model-mode-section.tsx`
   WHEN `TIERS_BY_MODE["txt2img"]` abgefragt wird
   THEN ist der Wert `["draft", "quality", "max"]` (unveraendert)

5) GIVEN `model-mode-section.tsx`
   WHEN `TIERS_BY_MODE["img2img"]` abgefragt wird
   THEN ist der Wert `["draft", "quality"]` (NICHT mehr `["draft", "quality", "max"]`)

6) GIVEN `model-mode-section.tsx`
   WHEN `TIERS_BY_MODE["upscale"]` abgefragt wird
   THEN ist der Wert `["quality", "max"]` (NICHT mehr `["draft", "quality"]`)

7) GIVEN `model-mode-section.tsx`
   WHEN `TIERS_BY_MODE["inpaint"]` abgefragt wird
   THEN ist der Wert `["quality"]`

8) GIVEN `model-mode-section.tsx`
   WHEN `TIERS_BY_MODE["outpaint"]` abgefragt wird
   THEN ist der Wert `["quality"]`

9) GIVEN `seedModelSettingsDefaults()` wird aufgerufen auf eine leere `model_settings`-Tabelle
   WHEN die eingefuegten Rows gezaehlt werden
   THEN sind es exakt 9 Rows: txt2img/draft, txt2img/quality, txt2img/max, img2img/draft, img2img/quality, upscale/quality, upscale/max, inpaint/quality, outpaint/quality

10) GIVEN `seedModelSettingsDefaults()` Rows
    WHEN die img2img-Rows geprueft werden
    THEN existiert KEINE Row mit `mode = "img2img"` und `tier = "max"`

11) GIVEN `seedModelSettingsDefaults()` Rows
    WHEN die upscale-Rows geprueft werden
    THEN existiert KEINE Row mit `mode = "upscale"` und `tier = "draft"`

12) GIVEN das gesamte Projekt
    WHEN `pnpm tsc --noEmit` ausgefuehrt wird
    THEN kompiliert TypeScript fehlerfrei (keine Type-Errors durch die Erweiterung)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Der Test-Writer implementiert die Assertions.

### Test-Datei: `lib/__tests__/types.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('GenerationMode type', () => {
  // AC-1: GenerationMode akzeptiert 5 Werte
  it.todo('should accept all 5 generation modes including inpaint and outpaint')

  // AC-2: VALID_GENERATION_MODES Array
  it.todo('should export VALID_GENERATION_MODES with exactly 5 entries')
})
```
</test_spec>

### Test-Datei: `components/settings/__tests__/model-mode-section.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('MODE_LABELS', () => {
  // AC-3: Labels fuer alle 5 Modes
  it.todo('should have labels for all 5 generation modes')
})

describe('TIERS_BY_MODE', () => {
  // AC-4: txt2img Tiers
  it.todo('should map txt2img to draft, quality, max')

  // AC-5: img2img Tiers (korrigiert)
  it.todo('should map img2img to draft, quality only (no max)')

  // AC-6: upscale Tiers (korrigiert)
  it.todo('should map upscale to quality, max only (no draft)')

  // AC-7: inpaint Tiers
  it.todo('should map inpaint to quality only')

  // AC-8: outpaint Tiers
  it.todo('should map outpaint to quality only')
})
```
</test_spec>

### Test-Datei: `lib/db/__tests__/queries-seed.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('seedModelSettingsDefaults', () => {
  // AC-9: Exakt 9 Rows
  it.todo('should insert exactly 9 default rows')

  // AC-10: Kein img2img/max
  it.todo('should not include img2img/max row')

  // AC-11: Kein upscale/draft
  it.todo('should not include upscale/draft row')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-06-server-actions` | `getModels` Server Action nutzt `VALID_GENERATION_MODES` | Validation | Capability-Validierung muss 5 Werte akzeptieren |
| `slice-07-service-replace` | `checkCompatibility` nutzt `GenerationMode` | Type | Muss 5 Modes unterstuetzen |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `GenerationMode` (erweitert) | Union Type | Alle Mode-Consumer (UI, Services, Actions) | `"txt2img" \| "img2img" \| "upscale" \| "inpaint" \| "outpaint"` |
| `VALID_GENERATION_MODES` (erweitert) | Const Array | Server Actions (Validierung) | `readonly ["txt2img", "img2img", "upscale", "inpaint", "outpaint"]` |
| `TIERS_BY_MODE` (korrigiert) | Const Record | Settings-Dialog (Rendering) | `Record<GenerationMode, Tier[]>` mit 5 Eintraegen |
| `MODE_LABELS` (erweitert) | Const Record | Settings-Dialog (Rendering) | `Record<GenerationMode, string>` mit 5 Eintraegen |
| `seedModelSettingsDefaults` (korrigiert) | Async Function | App-Init (Seeding) | Erzeugt 9 Rows statt 8 |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/types.ts` -- MODIFY: `GenerationMode` Union um `"inpaint" | "outpaint"` erweitern. `VALID_GENERATION_MODES` Array um die 2 neuen Werte erweitern. JSDoc-Kommentar aktualisieren
- [ ] `components/settings/model-mode-section.tsx` -- MODIFY: `MODE_LABELS` um `inpaint` und `outpaint` Eintraege erweitern. `TIERS_BY_MODE` korrigieren: `img2img` auf `["draft", "quality"]`, `upscale` auf `["quality", "max"]`, neue Keys `inpaint: ["quality"]` und `outpaint: ["quality"]`
- [ ] `lib/db/queries.ts` -- MODIFY: `seedModelSettingsDefaults()` Defaults-Array korrigieren: `img2img/max` Row entfernen, `upscale/draft` durch `upscale/max` ersetzen, `inpaint/quality` und `outpaint/quality` Rows hinzufuegen. Ergebnis: 9 Rows
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE UI-Logik-Aenderungen in `model-mode-section.tsx` (nur Konstanten anpassen)
- KEINE Aenderung an der Component-Signatur oder den Props von `ModelModeSection`
- KEINE neuen Server Actions oder Services
- KEINE Aenderung an `schema.ts` oder Migrations-Dateien
- KEINE Aenderung an `settings-dialog.tsx` (kommt in spaeteren UI-Slices)
- KEIN Dropdown-Filter-Logik-Umbau (kommt in spaeteren UI-Slices)

**Technische Constraints:**
- `TIERS_BY_MODE` Record-Key MUSS `GenerationMode` als Type verwenden (TypeScript erzwingt Vollstaendigkeit)
- `MODE_LABELS` Record-Key MUSS `GenerationMode` als Type verwenden (TypeScript erzwingt Vollstaendigkeit)
- `seedModelSettingsDefaults` muss `onConflictDoNothing` beibehalten (idempotent bei Re-Runs)
- Neue Seed-Rows fuer `inpaint` und `outpaint` brauchen sinnvolle Default-`modelId`-Werte (Placeholder-Models, z.B. leerer String oder ein bekanntes Replicate-Model)
- TypeScript `tsc --noEmit` muss fehlerfrei durchlaufen nach allen 3 Datei-Aenderungen

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/types.ts` | MODIFY — Type + Array erweitern, bestehende Exports beibehalten |
| `components/settings/model-mode-section.tsx` | MODIFY — Nur Konstanten-Objekte anpassen, Component-Body unveraendert |
| `lib/db/queries.ts` | MODIFY — Nur `seedModelSettingsDefaults()` Defaults-Array aendern, alle anderen Query-Funktionen unveraendert |

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` --> Section "Migration Map" --> `lib/types.ts` Zeile (GenerationMode-Erweiterung)
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` --> Section "Migration Map" --> `model-mode-section.tsx` Zeile (TIERS_BY_MODE-Korrektur)
- Architecture: `specs/phase-7/2026-03-15-model-catalog/architecture.md` --> Section "Migration Map" --> `queries.ts` Zeile (Seed auf 9 Rows)
- Discovery: `specs/phase-7/2026-03-15-model-catalog/discovery.md` --> Section "UI Layout & Context" (Tiers pro Capability-Section)
