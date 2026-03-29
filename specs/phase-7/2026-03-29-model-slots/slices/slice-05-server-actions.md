# Slice 5: Server Actions

> **Slice 5 von 7** fuer `Model Slots`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-05-server-actions` |
| **Test** | `pnpm test app/actions/model-slots` |
| **E2E** | `false` |
| **Dependencies** | `["slice-04-model-slot-service"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test app/actions/model-slots` |
| **Integration Command** | `pnpm tsc --noEmit` |
| **Acceptance Command** | N/A |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | N/A |
| **Mocking Strategy** | `mock_external` (ModelSlotService + requireAuth via Vitest mocks) |

---

## Ziel

Drei neue Server Actions (`getModelSlots`, `updateModelSlot`, `toggleSlotActive`) in `app/actions/model-slots.ts` erstellen, die Auth-Check und Input-Validierung durchfuehren und an `ModelSlotService` delegieren. Gleichzeitig die alte `app/actions/model-settings.ts` entfernen.

---

## Acceptance Criteria

1) GIVEN ein nicht-authentifizierter Aufruf (requireAuth gibt `{ error }` zurueck)
   WHEN `getModelSlots()` aufgerufen wird
   THEN wird `{ error: "Unauthorized" }` zurueckgegeben
   AND `ModelSlotService.getAll()` wird NICHT aufgerufen

2) GIVEN ein authentifizierter Aufruf
   WHEN `getModelSlots()` aufgerufen wird
   THEN wird das Ergebnis von `ModelSlotService.getAll()` zurueckgegeben (Array von `ModelSlot[]`)

3) GIVEN ein authentifizierter Aufruf mit Input `{ mode: "txt2img", slot: 1, modelId: "black-forest-labs/flux-2-pro" }`
   WHEN `updateModelSlot(input)` aufgerufen wird
   THEN wird `ModelSlotService.update("txt2img", 1, "black-forest-labs/flux-2-pro", undefined)` aufgerufen
   AND das Ergebnis (aktualisierter `ModelSlot` oder `{ error }`) wird zurueckgegeben

4) GIVEN ein authentifizierter Aufruf mit Input `{ mode: "invalid_mode", slot: 1, modelId: "org/model" }`
   WHEN `updateModelSlot(input)` aufgerufen wird
   THEN wird `{ error: "Invalid generation mode" }` zurueckgegeben
   AND `ModelSlotService.update()` wird NICHT aufgerufen

5) GIVEN ein authentifizierter Aufruf mit Input `{ mode: "txt2img", slot: 5, modelId: "org/model" }`
   WHEN `updateModelSlot(input)` aufgerufen wird
   THEN wird `{ error: "Invalid slot number" }` zurueckgegeben
   AND `ModelSlotService.update()` wird NICHT aufgerufen

6) GIVEN ein authentifizierter Aufruf mit Input `{ mode: "txt2img", slot: 1, modelId: "INVALID FORMAT!" }`
   WHEN `updateModelSlot(input)` aufgerufen wird
   THEN wird `{ error: "Invalid model ID format" }` zurueckgegeben
   AND `ModelSlotService.update()` wird NICHT aufgerufen

7) GIVEN ein authentifizierter Aufruf mit Input `{ mode: "txt2img", slot: 1, modelId: "org/model", modelParams: { guidance: 3.5 } }`
   WHEN `updateModelSlot(input)` aufgerufen wird
   THEN wird `ModelSlotService.update("txt2img", 1, "org/model", { guidance: 3.5 })` aufgerufen (modelParams weitergereicht)

8) GIVEN ein authentifizierter Aufruf mit Input `{ mode: "txt2img", slot: 2, active: false }`
   WHEN `toggleSlotActive(input)` aufgerufen wird
   THEN wird `ModelSlotService.toggleActive("txt2img", 2, false)` aufgerufen
   AND das Ergebnis (aktualisierter `ModelSlot` oder `{ error }`) wird zurueckgegeben

9) GIVEN ein authentifizierter Aufruf mit Input `{ mode: "txt2img", slot: 4, active: true }`
   WHEN `toggleSlotActive(input)` aufgerufen wird
   THEN wird `{ error: "Invalid slot number" }` zurueckgegeben
   AND `ModelSlotService.toggleActive()` wird NICHT aufgerufen

10) GIVEN ein nicht-authentifizierter Aufruf
    WHEN `updateModelSlot(input)` oder `toggleSlotActive(input)` aufgerufen wird
    THEN wird `{ error: "Unauthorized" }` zurueckgegeben

11) GIVEN die Datei `app/actions/model-settings.ts` existierte vorher
    WHEN Slice 05 fertig implementiert ist
    THEN existiert `app/actions/model-settings.ts` NICHT mehr
    AND `app/actions/model-slots.ts` exportiert `getModelSlots`, `updateModelSlot`, `toggleSlotActive`

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `app/actions/__tests__/model-slots.test.ts`

<test_spec>
```typescript
// AC-1: getModelSlots lehnt unauthentifizierten Aufruf ab
it.todo('should return Unauthorized error when not authenticated on getModelSlots')

// AC-2: getModelSlots delegiert an ModelSlotService.getAll
it.todo('should return ModelSlot array from service when authenticated on getModelSlots')

// AC-3: updateModelSlot delegiert validen Input an Service
it.todo('should call ModelSlotService.update with validated input and return result')

// AC-4: updateModelSlot lehnt ungueltige mode ab
it.todo('should return error for invalid generation mode without calling service')

// AC-5: updateModelSlot lehnt ungueltigen slot ab
it.todo('should return error for slot number outside 1-3 without calling service')

// AC-6: updateModelSlot lehnt ungueltige modelId ab
it.todo('should return error for modelId not matching regex without calling service')

// AC-7: updateModelSlot reicht modelParams an Service weiter
it.todo('should forward modelParams to ModelSlotService.update when provided')

// AC-8: toggleSlotActive delegiert validen Input an Service
it.todo('should call ModelSlotService.toggleActive with validated input and return result')

// AC-9: toggleSlotActive lehnt ungueltigen slot ab
it.todo('should return error for invalid slot number on toggleSlotActive')

// AC-10: updateModelSlot und toggleSlotActive lehnen unauthentifiziert ab
it.todo('should return Unauthorized on updateModelSlot and toggleSlotActive when not authenticated')

// AC-11: model-settings.ts entfernt, model-slots.ts exportiert 3 Actions
it.todo('should export getModelSlots, updateModelSlot, toggleSlotActive from model-slots.ts')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-04-model-slot-service` | `ModelSlotService.getAll()` | Async Method | Import kompiliert |
| `slice-04-model-slot-service` | `ModelSlotService.update(mode, slot, modelId, modelParams?)` | Async Method | Import kompiliert |
| `slice-04-model-slot-service` | `ModelSlotService.toggleActive(mode, slot, active)` | Async Method | Import kompiliert |
| `slice-03-types-resolve-model` | `VALID_GENERATION_MODES` | Const Export | Import kompiliert |
| `slice-03-types-resolve-model` | `VALID_SLOTS` | Const Export | Import kompiliert |
| `slice-02-db-queries` | `ModelSlot` | Type Export | Import kompiliert |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `getModelSlots()` | Server Action | UI-Slices (workspace, canvas, settings) | `() => Promise<ModelSlot[] \| { error: string }>` |
| `updateModelSlot(input)` | Server Action | UI-Slices (workspace, canvas popovers) | `(input: UpdateModelSlotInput) => Promise<ModelSlot \| { error: string }>` |
| `toggleSlotActive(input)` | Server Action | UI-Slices (workspace, canvas popovers) | `(input: ToggleSlotActiveInput) => Promise<ModelSlot \| { error: string }>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `app/actions/model-slots.ts` — NEW: 3 Server Actions (`getModelSlots`, `updateModelSlot`, `toggleSlotActive`) mit `"use server"`, Auth-Check, Input-Validierung, Delegation an ModelSlotService
- [ ] `app/actions/model-settings.ts` — DELETE: Alte Server Actions entfernen (ersetzt durch model-slots.ts)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE UI-Aenderungen (kommt in spaeteren Slices)
- KEINE Aenderungen an `ModelSlotService` (Slice 04)
- KEINE Aenderungen an `lib/types.ts`, `lib/db/queries.ts` oder `lib/db/schema.ts`
- KEINE Aenderungen an Consumer-Dateien die `model-settings.ts` Actions importieren — TS-Fehler in Consumern sind erwartet und werden durch spaetere Slices behoben
- KEIN Entfernen von `model-settings-service.ts` (Cleanup-Slice)

**Technische Constraints:**
- `"use server"` Direktive am Dateianfang (Next.js Server Action Pattern)
- Auth-Check via `requireAuth()` aus `@/lib/auth/guard` als erste Zeile jeder Action (gleicher Pattern wie bestehende `model-settings.ts`)
- Input-Validierung VOR Service-Aufruf: mode gegen `VALID_GENERATION_MODES`, slot gegen `VALID_SLOTS`, modelId gegen Regex `^[a-z0-9-]+/[a-z0-9._-]+$`
- `toggleSlotActive` validiert mode und slot, aber NICHT modelId (hat keinen modelId-Parameter)
- DTO-Types (`UpdateModelSlotInput`, `ToggleSlotActiveInput`) gemaess architecture.md Section "Data Transfer Objects" definieren — entweder in `lib/types.ts` oder lokal in der Action-Datei
- Fehler-Rueckgabe als `{ error: string }` (kein Throw), konsistent mit bestehendem Pattern

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `app/actions/model-settings.ts` | Pattern-Referenz: gleiche Struktur (Auth-Check, Validation, Service-Delegation). Wird GELOESCHT und durch `model-slots.ts` ersetzt |
| `lib/auth/guard.ts` | Import: `requireAuth` fuer Auth-Check, unveraendert |

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-29-model-slots/architecture.md` -> Section "API Design" (Server Actions, DTOs, Validation Rules)
- Architecture: `specs/phase-7/2026-03-29-model-slots/architecture.md` -> Section "Security" (Input Validation & Sanitization)
- Architecture: `specs/phase-7/2026-03-29-model-slots/architecture.md` -> Section "Error Handling Strategy"
