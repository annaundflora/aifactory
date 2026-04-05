# Slice 9: Erase Direct Flow

> **Slice 9 von 16** fuer `AI Image Editing Suite`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-09-erase-flow` |
| **Test** | `pnpm test components/canvas/__tests__/canvas-erase-flow.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-07-inpaint-integration"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/__tests__/canvas-erase-flow.test.tsx` |
| **Integration Command** | -- |
| **Acceptance Command** | `pnpm test -- --run` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (MaskService, generateImages, R2 Upload gemockt) |

---

## Ziel

Den Erase-Direct-Flow verdrahten: Wenn der User im Erase-Modus den "Entfernen"-Button klickt, wird die Mask-Export-Pipeline ausgefuehrt und `generateImages()` direkt aufgerufen (kein Canvas Agent, kein SSE). Zusaetzlich wird ein Chat-Prompt im Erase-Modus automatisch zu Inpaint hochgestuft (Maske + Prompt -> Inpaint statt Erase).

---

## Acceptance Criteria

1) GIVEN der User ist im Erase-Modus (`editMode === "erase"`) und hat eine gueltige Maske gemalt
   WHEN der User den `erase-action-btn` ("Entfernen") in der FloatingBrushToolbar klickt
   THEN wird die Mask-Export-Pipeline ausgefuehrt: `MaskService.validateMinSize(minSize: 10)` -> `applyFeathering(radius: 10)` -> `scaleToOriginal()` -> `toGrayscalePng()`
   AND der resultierende PNG-Blob wird zu R2 hochgeladen (Prefix `masks/`)
   AND `generateImages()` wird direkt aufgerufen mit `generationMode: "erase"`, `maskUrl` (R2-URL) und `sourceImageUrl` (aktuelles Bild)
   AND kein SSE-Stream / Canvas Agent wird involviert

2) GIVEN der Erase-Action wurde ausgefuehrt und `generateImages()` + Polling liefern ein Ergebnis-Bild
   WHEN das Ergebnis vorliegt
   THEN wird `PUSH_UNDO` mit dem aktuellen Bild dispatched
   AND `SET_CURRENT_IMAGE` mit der neuen Bild-URL dispatched
   AND die Maske bleibt im State erhalten (User kann iterieren)

3) GIVEN der User ist im Erase-Modus und hat eine Maske gemalt
   WHEN `MaskService.validateMinSize()` `{ valid: false }` zurueckgibt
   THEN wird ein Toast mit "Markiere einen groesseren Bereich" angezeigt
   AND `generateImages()` wird NICHT aufgerufen

4) GIVEN der User ist im Erase-Modus und hat KEINE Maske gemalt (`maskData === null`)
   WHEN der User den `erase-action-btn` klickt
   THEN ist der Button `disabled` und kein Aufruf erfolgt

5) GIVEN der User ist im Erase-Modus (`editMode === "erase"`) und hat eine Maske gemalt
   WHEN der User einen Chat-Prompt sendet (statt "Entfernen" zu klicken)
   THEN wird der Flow zu Inpaint hochgestuft: `generateImages()` wird mit `generationMode: "inpaint"` und `maskUrl` + `sourceImageUrl` + dem Prompt aufgerufen
   AND es wird KEIN Erase-Call ausgefuehrt

6) GIVEN der R2 Mask-Upload schlaegt fehl
   WHEN `handleEraseAction()` ausgefuehrt wird
   THEN wird ein Toast mit "Mask-Upload fehlgeschlagen" angezeigt
   AND `generateImages()` wird NICHT aufgerufen
   AND die Maske bleibt im State erhalten

7) GIVEN `handleEraseAction()` laeuft (Generating-State)
   WHEN der User sich im `generating` State befindet
   THEN sind `erase-action-btn`, alle Toolbar-Buttons und das Chat-Input disabled

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/__tests__/canvas-erase-flow.test.tsx`

<test_spec>
```typescript
// AC-1: Erase-Action fuehrt Mask-Pipeline aus und ruft generateImages direkt auf
it.todo('should run mask export pipeline and call generateImages with mode erase directly without SSE')

// AC-2: PUSH_UNDO und SET_CURRENT_IMAGE nach erfolgreichem Erase-Ergebnis
it.todo('should dispatch PUSH_UNDO and SET_CURRENT_IMAGE after successful erase generation')

// AC-3: Toast bei zu kleiner Maske, kein generateImages-Aufruf
it.todo('should show toast and skip generation when mask validation fails')

// AC-4: Erase-Action-Button disabled wenn keine Maske vorhanden
it.todo('should disable erase action button when maskData is null')

// AC-5: Chat-Prompt im Erase-Modus stuft zu Inpaint hoch
it.todo('should upgrade to inpaint mode when chat prompt sent in erase mode with mask')

// AC-6: Toast bei R2-Upload-Fehler, kein generateImages-Aufruf
it.todo('should show mask upload error toast and preserve mask when R2 upload fails')

// AC-7: UI disabled waehrend Generating-State
it.todo('should disable erase action button and toolbar during generating state')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-02` | `CanvasDetailState.editMode`, `maskData`, `currentImageUrl` + Dispatch `PUSH_UNDO`, `SET_CURRENT_IMAGE` | State + Actions | State-Felder lesbar, Dispatch aendert State |
| `slice-04` | `FloatingBrushToolbar` mit `onEraseAction` Callback-Prop | Component | Gemountet in canvas-detail-view, ruft Callback auf Button-Klick |
| `slice-05` | `validateMinSize`, `applyFeathering`, `scaleToOriginal`, `toGrayscalePng` | Functions | Import aus `lib/services/mask-service.ts` |
| `slice-06a` | `generateImages()` mit `generationMode`, `maskUrl`, `sourceImageUrl` | Server Action | Akzeptiert `"erase"` und `"inpaint"` mit `maskUrl` |
| `slice-07` | `handleCanvasGenerate` mit Inpaint-Branch, Mask-Upload-Pipeline Pattern, `erase-btn` Toolbar-Button | Function + Pattern | Erase-Branch referenziert Mask-Upload-Sequenz aus Slice 07 |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `handleEraseAction()` | Function | slice-11 (Click-to-Edit -> Erase) | `(maskData: ImageData, sourceImageUrl: string) => Promise<void>` |
| Erase-to-Inpaint Upgrade Pattern | Behavior | -- | Chat-Prompt im Erase-Modus -> Inpaint-Aufruf statt Erase |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/canvas-detail-view.tsx` -- MODIFY: `handleEraseAction` Funktion implementieren (Mask-Pipeline + direkter `generateImages`-Aufruf), Erase-to-Inpaint-Upgrade bei Chat-Prompt im Erase-Modus, MaskCanvas + FloatingBrushToolbar Einbindung in Center-Column
- [ ] `components/canvas/floating-brush-toolbar.tsx` -- MODIFY: `erase-action-btn` onClick-Handler an `onEraseAction` Callback verdrahten, Button-disabled-State an `maskData === null` und `isGenerating` koppeln
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Canvas Agent / SSE-Pipeline fuer Erase (Erase ist ein direkter `generateImages()`-Aufruf)
- KEINE Instruction-Editing-Logik (Slice 08)
- KEINE Outpaint-Logik (Slice 13)
- KEINE Click-to-Edit / SAM-Integration (Slice 10/11)
- KEINE Keyboard Shortcuts (Slice 14)
- KEIN MaskCanvas-Component-Code (bereits in Slice 03 erstellt)
- KEIN MaskService-Code (bereits in Slice 05 erstellt)
- KEIN FloatingBrushToolbar-Layout/Styling (bereits in Slice 04 erstellt -- hier nur onClick-Verdrahtung)

**Technische Constraints:**
- `handleEraseAction()` ruft `generateImages()` DIREKT auf -- kein SSE, kein Agent (siehe architecture.md -> Constraints: "Erase flow bypasses Canvas Agent")
- Mask-Upload zu R2 via bestehende `StorageService.upload()` mit Prefix `masks/`
- Erase-to-Inpaint Upgrade: Wenn `editMode === "erase"` und User Chat-Prompt sendet -> `generationMode: "inpaint"` statt `"erase"` verwenden
- Toast-Meldungen auf Deutsch (konsistent mit architecture.md -> Error Handling Strategy)
- Polling-Pattern fuer async Ergebnis: bestehendes Generation-Polling wiederverwenden

**Reuse (PFLICHT):**

| Existing File | Usage in this Slice |
|---|---|
| `components/canvas/canvas-detail-view.tsx` | MODIFY -- `handleEraseAction` hinzufuegen, Center-Column Composition |
| `components/canvas/floating-brush-toolbar.tsx` | MODIFY -- `erase-action-btn` onClick verdrahten |
| `lib/services/mask-service.ts` | IMPORT -- `validateMinSize`, `applyFeathering`, `scaleToOriginal`, `toGrayscalePng` |
| `app/actions/generations.ts` | IMPORT -- `generateImages()` mit `generationMode: "erase"` |
| `lib/canvas-detail-context.tsx` | IMPORT -- `useCanvasDetail()` fuer State + Dispatch |
| `components/canvas/canvas-chat-panel.tsx` | MODIFY-AWARE -- Erase-to-Inpaint Upgrade greift in handleCanvasGenerate ein (Slice 07 hat den Inpaint-Branch bereits) |

**Referenzen:**
- Architecture: `architecture.md` -> Constraints Zeile 361 ("Erase flow bypasses Canvas Agent")
- Architecture: `architecture.md` -> Data Flow Zeile 180-187 (Erase Flow -- No Agent)
- Architecture: `architecture.md` -> Validation Rules Zeile 207 ("maskUrl required when generationMode is erase")
- Architecture: `architecture.md` -> Error Handling Strategy Zeile 311/315 (Mask too small / Upload failed Toasts)
- Wireframes: `wireframes.md` -> Screen "Painting Mode (Erase)" (erase-action-btn Annotation, State Variations)
- Discovery: `discovery.md` -> Flow 2: Object Removal (Erase) (Steps 1-5, Error Paths)
