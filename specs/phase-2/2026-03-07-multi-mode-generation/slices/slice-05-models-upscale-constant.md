# Slice 05: Models — UPSCALE_MODEL Konstante

> **Slice 5 von 6** für `Multi-Mode Generation (img2img + Upscale)`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-05-models-upscale-constant` |
| **Test** | `pnpm test lib/__tests__/models.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/__tests__/models.test.ts` |
| **Integration Command** | `pnpm test lib/__tests__/` |
| **Acceptance Command** | — |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` (reine Konstantenprüfung, kein I/O) |

---

## Ziel

`lib/models.ts` erhält eine neue exportierte Konstante `UPSCALE_MODEL` mit dem Replicate-Model-String `"nightmareai/real-esrgan"`. Die bestehende `MODELS`-Liste und `getModelById()` bleiben unberührt. Der Slice stellt den einzigen Referenzpunkt für den Upscale-Model-Identifier bereit, auf den `GenerationService.upscale()` in späteren Slices zurückgreift.

---

## Acceptance Criteria

1) GIVEN die Datei `lib/models.ts` ist importiert
   WHEN `UPSCALE_MODEL` exportiert wird
   THEN hat die Konstante den exakten String-Wert `"nightmareai/real-esrgan"`

2) GIVEN `UPSCALE_MODEL` wurde zur Datei hinzugefügt
   WHEN `MODELS` exportiert wird
   THEN enthält das Array weiterhin genau 9 Einträge (unverändert gegenüber Ausgangszustand)

3) GIVEN `UPSCALE_MODEL` wurde zur Datei hinzugefügt
   WHEN `getModelById("nightmareai/real-esrgan")` aufgerufen wird
   THEN gibt die Funktion `undefined` zurück (`UPSCALE_MODEL` ist kein Eintrag in `MODELS`)

4) GIVEN `UPSCALE_MODEL` ist ein `string`-Export
   WHEN der TypeScript-Compiler die Datei prüft
   THEN ist der Typ von `UPSCALE_MODEL` `string` (kein Template-Literal-Typ erforderlich)

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Keine Mocks nötig — reine Wert- und Längenprüfungen auf den Exports.

### Test-Datei: `lib/__tests__/models.test.ts`

<test_spec>
```typescript
// AC-1: UPSCALE_MODEL hat den korrekten Replicate-Model-String
it.todo('should export UPSCALE_MODEL as "nightmareai/real-esrgan"')

// AC-2: MODELS-Array bleibt nach Hinzufügen der Konstante unverändert (9 Einträge)
it.todo('should keep MODELS array unchanged with 9 entries')

// AC-3: UPSCALE_MODEL ist kein Eintrag in MODELS
it.todo('should return undefined when getModelById is called with UPSCALE_MODEL id')

// AC-4: UPSCALE_MODEL ist vom Typ string
it.todo('should have type string for UPSCALE_MODEL')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| — | — | — | Keine Slice-Abhängigkeiten |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `UPSCALE_MODEL` | `string` Konstante | Generation-Service (Upscale-Slice) | `export const UPSCALE_MODEL: string` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/models.ts` — neue exportierte Konstante `UPSCALE_MODEL = "nightmareai/real-esrgan"` hinzufügen; `MODELS`-Array und `getModelById()` unverändert lassen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt `lib/__tests__/models.test.ts` basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Keine Änderungen an `MODELS`, `Model`-Interface oder `getModelById()`
- `UPSCALE_MODEL` wird nicht in `MODELS` aufgenommen — das Modell ist kein wählbares Nutzer-Modell
- Keine zusätzliche Typ-Definition oder `UpscaleModel`-Interface

**Technische Constraints:**
- Konstante als einfacher `string`-Export, kein `as const` oder Literal-Typ erforderlich
- Platzierung am Ende der Datei nach den bestehenden Exports

**Referenzen:**
- Modell-Wahl-Begründung: `architecture.md` → Section "Constraints & Integrations → Constraints" (Zeile "Upscale model is fixed")
- Upscale-Flow-Kontext: `architecture.md` → Section "Server Logic → Business Logic Flow → Upscale"
- Fallback-Modelle (falls nötig): `architecture.md` → Section "Risks & Assumptions → Assumptions" (Zeile `nightmareai/real-esrgan`)
