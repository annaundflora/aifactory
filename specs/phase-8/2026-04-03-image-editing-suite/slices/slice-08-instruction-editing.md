# Slice 8: Instruction Editing Flow

> **Slice 8 von 16** fuer `AI Image Editing Suite`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-08-instruction-editing` |
| **Test** | `pnpm test components/canvas/__tests__/canvas-chat-panel-instruction.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-07-inpaint-integration"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/__tests__/canvas-chat-panel-instruction.test.tsx` |
| **Integration Command** | -- |
| **Acceptance Command** | `pnpm test -- --run` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (generateImages, resolveActiveSlots, Canvas Agent SSE gemockt) |

---

## Ziel

Den Instruction-Editing-Branch in `handleCanvasGenerate` verdrahten, sodass bei `action="instruction"` (kein Edit-Tool aktiv, kein Mask-Daten vorhanden) der Canvas Agent den Prompt als Text-Instruktion an `generateImages()` mit `generationMode="instruction"` weiterleitet. Slot-Resolution muss den `instruction`-Mode nutzen, um das korrekte Modell (FLUX Kontext Pro) aufzuloesen.

---

## Acceptance Criteria

1) GIVEN ein SSE-Event mit `action: "instruction"` trifft in `handleCanvasGenerate` ein
   AND `state.editMode` ist `null` (kein Edit-Tool aktiv)
   AND `state.maskData` ist `null` (keine Maske)
   WHEN der Handler ausgefuehrt wird
   THEN wird `resolveActiveSlots(modelSlots, "instruction")` aufgerufen
   AND `generateImages()` wird mit `generationMode: "instruction"` und `sourceImageUrl` (aktuelle Bild-URL aus imageContext) aufgerufen
   AND `maskUrl` ist `undefined` (keine Maske)

2) GIVEN ein SSE-Event mit `action: "instruction"` trifft ein
   AND `resolveActiveSlots("instruction")` gibt einen aktiven Slot zurueck
   WHEN der Handler ausgefuehrt wird
   THEN wird die `modelId` aus dem aufgeloesten instruction-Slot verwendet (nicht der img2img-Slot)
   AND `modelParams` des instruction-Slots werden mit `event.params` gemerged (event ueberschreibt)

3) GIVEN ein SSE-Event mit `action: "instruction"` trifft ein
   AND `resolveActiveSlots("instruction")` gibt leeres Array zurueck (kein Slot konfiguriert)
   WHEN der Handler ausgefuehrt wird
   THEN wird `generation.modelId` als Fallback verwendet (konsistent mit bestehendem Fallback-Pattern)

4) GIVEN `generateImages()` wird mit `generationMode: "instruction"` aufgerufen und Polling liefert ein Ergebnis
   WHEN das Ergebnis-Bild vorliegt
   THEN wird `PUSH_UNDO` mit dem aktuellen Bild dispatched
   AND `SET_CURRENT_IMAGE` mit der neuen Bild-URL dispatched
   AND ein `onGenerationsCreated` Callback wird mit den neuen Generations aufgerufen

5) GIVEN ein SSE-Event mit `action: "instruction"` trifft ein
   AND `generateImages()` gibt `{ error: string }` zurueck
   WHEN der Handler ausgefuehrt wird
   THEN wird ein Toast mit der Fehlermeldung angezeigt
   AND `SET_GENERATING` wird mit `false` dispatched
   AND das aktuelle Bild bleibt unveraendert

6) GIVEN der Gesamt-Flow: User tippt "Mach den Himmel blauer" im Canvas-Chat
   AND kein Edit-Tool ist aktiv (editMode === null)
   WHEN der Canvas Agent das SSE-Event mit `action: "instruction"` sendet
   THEN durchlaeuft handleCanvasGenerate den instruction-Branch
   AND `generateImages()` erhaelt `generationMode: "instruction"`, `sourceImageUrl`, `promptMotiv` (User-Prompt)
   AND das Ergebnis-Bild ersetzt das aktuelle Bild via PUSH_UNDO + SET_CURRENT_IMAGE

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/__tests__/canvas-chat-panel-instruction.test.tsx`

<test_spec>
```typescript
// AC-1: instruction-Branch ruft generateImages mit generationMode instruction und sourceImageUrl auf
it.todo('should call generateImages with generationMode instruction and sourceImageUrl when action is instruction')

// AC-2: instruction-Slot-Resolution nutzt instruction-Mode Slots
it.todo('should resolve model slots for instruction mode and use instruction slot modelId and params')

// AC-3: Fallback auf generation.modelId wenn kein instruction-Slot konfiguriert
it.todo('should fall back to generation.modelId when no instruction slot is configured')

// AC-4: PUSH_UNDO und SET_CURRENT_IMAGE nach erfolgreichem Polling
it.todo('should dispatch PUSH_UNDO and SET_CURRENT_IMAGE and call onGenerationsCreated after successful instruction generation')

// AC-5: Error-Handling bei generateImages Fehler
it.todo('should show error toast and reset isGenerating when generateImages returns error for instruction mode')

// AC-6: End-to-End instruction-Flow von Chat-Prompt bis Bild-Ersetzung
it.todo('should route instruction action through full flow: resolveActiveSlots instruction -> generateImages -> PUSH_UNDO -> SET_CURRENT_IMAGE')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-07` | `handleCanvasGenerate` mit action-Switch | Function | instruction-Branch wird als neuer case hinzugefuegt |
| `slice-07` | `SSECanvasGenerateEvent` mit `action: "instruction"` | Type | action-Union enthaelt `"instruction"` (in Slice 07 bereits erweitert) |
| `slice-07` | `parseSSEEvent` fuer `action: "instruction"` | Function | Parsed instruction-Events korrekt |
| `slice-02` | `CanvasDetailState.editMode`, `maskData` | State | Lesbar via `useCanvasDetail()` |
| `slice-06a` | `generateImages()` mit `generationMode: "instruction"` | Server Action | Akzeptiert `"instruction"` als generationMode |
| `slice-01` | `resolveActiveSlots(modelSlots, "instruction")` | Function | Loest instruction-Mode-Slots auf |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `handleCanvasGenerate` instruction-Branch | Function Branch | slice-13 (outpaint nutzt gleiches Pattern) | `case "instruction":` in action-Switch |
| Instruction-Mode Slot-Resolution Pattern | Pattern | slice-13 (outpaint-Slot-Resolution) | `resolveActiveSlots(modelSlots, mode)` → Slot-basierte Model-Aufloesung |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/canvas-chat-panel.tsx` — MODIFY: instruction-Branch in `handleCanvasGenerate` hinzufuegen: action-zu-mode Mapping, instruction-spezifische Slot-Resolution via `resolveActiveSlots("instruction")`, `generateImages()` Aufruf mit `generationMode: "instruction"` + `sourceImageUrl` (keine Maske)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN neuer Erase-Direct-Flow (Slice 09)
- KEINE Outpaint-Logik (Slice 13)
- KEINE Click-to-Edit/SAM-Logik (Slice 10/11)
- KEIN neues UI-Element — der instruction-Flow nutzt ausschliesslich den bestehenden Canvas-Chat-Input
- KEINE Aenderung an `canvas-chat-service.ts` oder `canvas-toolbar.tsx` (bereits in Slice 07 erweitert)
- KEIN Generating-State-Overlay (bestehendes Pattern in canvas-detail-view reicht)
- KEINE Maske-Logik: wenn `action="instruction"`, wird KEINE MaskService-Pipeline aufgerufen

**Technische Constraints:**
- Action-zu-Mode-Mapping: `"instruction"` → `generationMode: "instruction"` (1:1)
- Slot-Resolution: `resolveActiveSlots(modelSlots, "instruction")` — nutzt instruction-Seed-Slot (FLUX Kontext Pro, aus Slice 01)
- `sourceImageUrl` MUSS aus `imageContextRef.current.image_url` stammen (konsistent mit img2img-Pattern)
- Bestehende Error-Handling-Patterns beibehalten: `{ error: string }` Check + Toast + `SET_GENERATING: false`
- Bestehende Undo-Patterns beibehalten: `PUSH_UNDO` + `SET_CURRENT_IMAGE` + `onGenerationsCreated`

**Reuse (PFLICHT):**

| Existing File | Usage in this Slice |
|---|---|
| `components/canvas/canvas-chat-panel.tsx` | MODIFY — `handleCanvasGenerate` um instruction-Branch erweitern |
| `lib/canvas-detail-context.tsx` | IMPORT — `useCanvasDetail()` fuer State (editMode, maskData) |
| `app/actions/generations.ts` | IMPORT — `generateImages()` mit `generationMode: "instruction"` |

**Referenzen:**
- Architecture: `architecture.md` → Server Logic Zeile 148 (instruction: image+prompt, keine Maske)
- Architecture: `architecture.md` → Business Logic Flow Zeile 163 (`action="instruction"` fuer No Mask + Edit Intent)
- Architecture: `architecture.md` → Seed Defaults Zeile 134 (instruction Slot 1: FLUX Kontext Pro)
- Architecture: `architecture.md` → Migration Map Zeile 331 (canvas-chat-panel handleCanvasGenerate Extension)
- Discovery: `discovery.md` → Flow 3: Instruction Editing Zeile 133-143
- Wireframes: `wireframes.md` → Screen "Generating State" Zeile 358 (`generating (from instruction edit)`: Loading overlay only, no mask, no floating toolbar)
