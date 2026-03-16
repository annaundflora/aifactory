# Slice 1: resolveModel Utility extrahieren

> **Slice 1 von 4** fuer `Model Parameter Controls (Aspect Ratio, Size & Advanced)`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-01-resolve-model-utility` |
| **Test** | `pnpm test lib/utils/resolve-model.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/utils/resolve-model.test.ts` |
| **Integration Command** | n/a |
| **Acceptance Command** | `pnpm tsc --noEmit` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | n/a |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Die inline `resolveModel()`-Funktion aus `prompt-area.tsx:128-141` in ein eigenstaendiges, testbares Utility unter `lib/utils/resolve-model.ts` extrahieren. Der Import in `prompt-area.tsx` wird auf das neue Modul umgestellt. Spaetere Slices (Canvas Popovers) koennen die Funktion ebenfalls importieren.

---

## Acceptance Criteria

1) GIVEN ein Array von `ModelSetting[]` mit einem Eintrag `{ mode: "txt2img", tier: "draft", modelId: "black-forest-labs/flux-schnell", modelParams: { megapixels: "1" } }`
   WHEN `resolveModel(settings, "txt2img", "draft")` aufgerufen wird
   THEN gibt die Funktion `{ modelId: "black-forest-labs/flux-schnell", modelParams: { megapixels: "1" } }` zurueck

2) GIVEN ein Array von `ModelSetting[]` mit Eintraegen fuer `txt2img/draft` und `txt2img/quality`
   WHEN `resolveModel(settings, "txt2img", "max")` aufgerufen wird (kein Eintrag fuer `max`)
   THEN gibt die Funktion `undefined` zurueck

3) GIVEN ein `ModelSetting` mit `modelParams: null`
   WHEN `resolveModel(settings, mode, tier)` aufgerufen wird und der Eintrag matched
   THEN gibt die Funktion `{ modelId: "...", modelParams: {} }` zurueck (null wird zu leerem Objekt normalisiert)

4) GIVEN `prompt-area.tsx` mit dem Import von `resolveModel` aus `@/lib/utils/resolve-model`
   WHEN `pnpm tsc --noEmit` ausgefuehrt wird
   THEN kompiliert das Projekt fehlerfrei

5) GIVEN `prompt-area.tsx` nach dem Refactoring
   WHEN nach einer inline `function resolveModel` im Datei-Body gesucht wird
   THEN existiert KEINE inline-Definition mehr (die Funktion ist vollstaendig entfernt)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/utils/resolve-model.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('resolveModel', () => {
  // AC-1: Findet Setting nach mode+tier und gibt modelId+modelParams zurueck
  it.todo('should return modelId and modelParams for matching mode+tier')

  // AC-2: Gibt undefined zurueck wenn kein Setting fuer mode+tier existiert
  it.todo('should return undefined when no setting matches mode+tier')

  // AC-3: Normalisiert null modelParams zu leerem Objekt
  it.todo('should normalize null modelParams to empty object')

  // AC-4: TypeScript-Kompilierung nach Refactoring fehlerfrei
  it.todo('should compile without errors after refactoring import to @/lib/utils/resolve-model')

  // AC-5: Keine inline resolveModel-Definition mehr in prompt-area.tsx
  it.todo('should not contain an inline resolveModel definition in prompt-area.tsx')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| -- | -- | -- | -- |

Keine Abhaengigkeiten. Verwendet nur bestehende Projekt-Types (`ModelSetting`, `GenerationMode`, `Tier`).

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `resolveModel` | Function | slice-02 (ParameterPanel), slice-03 (Prompt Panel), slice-04 (Canvas Popovers) | `resolveModel(settings: ModelSetting[], mode: GenerationMode, tier: Tier) => { modelId: string; modelParams: Record<string, unknown> } \| undefined` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/utils/resolve-model.ts` — Neues Utility: exportiert `resolveModel()` als named export
- [ ] `components/workspace/prompt-area.tsx` — MODIFY: inline `resolveModel` entfernen, Import aus `@/lib/utils/resolve-model` hinzufuegen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice aendert NUR die Lokation der Funktion, NICHT ihr Verhalten
- Kein neuer Hook (`useModelSchema` kommt in einem spaeteren Slice)
- Keine neuen UI-Aenderungen
- Keine Aenderungen an Canvas Popovers (die importieren `resolveModel` erst in Slice 4)

**Technische Constraints:**
- Identische Signatur und Semantik wie `prompt-area.tsx:128-141`
- Named export (`export function resolveModel`), kein default export
- Types `ModelSetting`, `GenerationMode`, `Tier` aus bestehenden Modulen importieren (nicht neu definieren)
- Alle 4 bestehenden Aufrufstellen in `prompt-area.tsx` (Zeilen 668, 690, 728, 923) muessen nach dem Refactoring den importierten `resolveModel` verwenden

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-15-aspect-ratio-controls/architecture.md` → Section "Architecture Layers" (resolveModel Utility)
- Architecture: `specs/phase-7/2026-03-15-aspect-ratio-controls/architecture.md` → Section "Migration Map > Existing Files Changed" (prompt-area.tsx Zeile)
- Source-Code: `components/workspace/prompt-area.tsx:128-141` (aktuelle inline-Implementierung)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/workspace/prompt-area.tsx:128-141` | Bestehende `resolveModel`-Logik 1:1 extrahieren, danach inline-Version entfernen |
| `lib/types.ts` | Import `Tier`, `GenerationMode` — NICHT neu definieren |
| `lib/db/queries.ts` | Import `ModelSetting` Type — NICHT neu definieren |
