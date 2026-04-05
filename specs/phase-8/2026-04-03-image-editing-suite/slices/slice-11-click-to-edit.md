# Slice 11: Click-to-Edit Frontend

> **Slice 11 von 16** fuer `AI Image Editing Suite`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-11-click-to-edit` |
| **Test** | `pnpm test components/canvas/__tests__/canvas-detail-view-click-edit.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-07-inpaint-integration", "slice-10-sam-api"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/__tests__/canvas-detail-view-click-edit.test.tsx` |
| **Integration Command** | -- |
| **Acceptance Command** | `pnpm test -- --run` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (SAM API Route gemockt via fetch-Mock, MaskCanvas-Rendering gemockt, CanvasDetailContext gemockt) |

---

## Ziel

Click-to-Edit UI-Flow in `canvas-detail-view.tsx` implementieren: Wenn `click-edit` Toolbar-Button aktiv ist, wechselt der Cursor zu Crosshair. Klick auf das Bild berechnet normalisierte Koordinaten, ruft `POST /api/sam/segment` auf, zeigt Loading-Indicator, rendert die SAM-Mask als rotes Overlay im MaskCanvas und wechselt in den Painting-State mit Floating Toolbar. Confirmation-Dialog bei bestehender Maske, Error-Handling bei SAM-Fehlern.

---

## Acceptance Criteria

1) GIVEN `editMode` ist `"click-edit"` im CanvasDetailState
   WHEN die Canvas-Image-Area gerendert wird
   THEN hat das Bild-Element `cursor: crosshair` als CSS-Style
   AND die Floating Brush Toolbar ist NICHT sichtbar
   AND kein Mask-Overlay ist aktiv (solange kein Klick erfolgt ist)

2) GIVEN `editMode` ist `"click-edit"` und `maskData` ist `null`
   WHEN der User auf das Bild klickt bei Position (clientX, clientY)
   THEN werden normalisierte Koordinaten berechnet als `click_x = offsetX / imageDisplayWidth`, `click_y = offsetY / imageDisplayHeight` (Werte 0.0-1.0)
   AND `POST /api/sam/segment` wird aufgerufen mit `{ image_url: currentImageUrl, click_x, click_y }`

3) GIVEN der SAM-API-Call laeuft (fetch pending)
   WHEN der Loading-State aktiv ist
   THEN wird ein Loading-Spinner ueber dem Bild angezeigt
   AND weitere Klicks auf das Bild werden ignoriert (Click-Handler deaktiviert)

4) GIVEN `POST /api/sam/segment` antwortet mit HTTP 200 und `{ mask_url: "<URL>" }`
   WHEN die Response verarbeitet wird
   THEN wird die Mask-PNG von `mask_url` geladen und als rotes Semi-Transparent-Overlay (50% Opacity) im MaskCanvas gerendert
   AND `SET_MASK_DATA` wird mit der geladenen ImageData dispatched
   AND `SET_EDIT_MODE` wird mit `"inpaint"` dispatched (Transition zu Painting-State)
   AND die Floating Brush Toolbar erscheint (User kann Maske verfeinern)

5) GIVEN `editMode` ist `"click-edit"` und `maskData` ist NICHT `null` (bestehende Maske vorhanden)
   WHEN der User auf das Bild klickt
   THEN erscheint ein Confirmation-Dialog mit Text "Diese Aktion ersetzt deine aktuelle Maske. Fortfahren?" und Buttons [Abbrechen] [Ersetzen]

6) GIVEN der Confirmation-Dialog ist sichtbar
   WHEN der User "Ersetzen" klickt
   THEN wird die bestehende Maske verworfen, `SET_MASK_DATA` mit `null` dispatched
   AND der SAM-API-Call wird mit den Klick-Koordinaten ausgefuehrt (wie AC-2)

7) GIVEN der Confirmation-Dialog ist sichtbar
   WHEN der User "Abbrechen" klickt
   THEN bleibt die bestehende Maske erhalten
   AND kein SAM-API-Call wird ausgefuehrt

8) GIVEN `POST /api/sam/segment` antwortet mit HTTP 422 (kein Objekt erkannt)
   WHEN die Error-Response verarbeitet wird
   THEN wird ein Error-Toast angezeigt mit Text "Kein Objekt erkannt. Versuche einen anderen Punkt."
   AND der `editMode` bleibt auf `"click-edit"` (User kann erneut klicken)
   AND kein Loading-Spinner ist sichtbar

9) GIVEN `POST /api/sam/segment` antwortet mit HTTP 502 oder Netzwerk-Fehler
   WHEN die Error-Response verarbeitet wird
   THEN wird ein Error-Toast angezeigt mit Text "SAM-Fehler. Versuche manuelles Maskieren."
   AND der `editMode` bleibt auf `"click-edit"`

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/__tests__/canvas-detail-view-click-edit.test.tsx`

<test_spec>
```typescript
// AC-1: Crosshair-Cursor und kein Overlay bei click-edit Mode
it.todo('should show crosshair cursor and hide floating toolbar when editMode is click-edit')

// AC-2: Klick auf Bild berechnet normalisierte Koordinaten und ruft SAM API auf
it.todo('should calculate normalized coordinates and call POST /api/sam/segment on image click')

// AC-3: Loading-Spinner waehrend SAM-Call, weitere Klicks ignoriert
it.todo('should show loading spinner and ignore clicks while SAM request is pending')

// AC-4: SAM-Erfolg rendert Mask-Overlay und wechselt zu inpaint Mode
it.todo('should render mask overlay and dispatch SET_EDIT_MODE inpaint on SAM 200 response')

// AC-5: Confirmation-Dialog wenn maskData bereits vorhanden
it.todo('should show confirmation dialog when clicking image with existing maskData')

// AC-6: Ersetzen-Button im Dialog verwirft Maske und startet SAM-Call
it.todo('should clear mask and trigger SAM call when user confirms replacement')

// AC-7: Abbrechen-Button im Dialog behaelt Maske ohne SAM-Call
it.todo('should keep existing mask and skip SAM call when user cancels')

// AC-8: HTTP 422 zeigt Kein-Objekt-Toast und bleibt in click-edit Mode
it.todo('should show no-object-found toast on 422 and stay in click-edit mode')

// AC-9: HTTP 502 / Netzwerkfehler zeigt SAM-Fehler-Toast
it.todo('should show SAM error toast on 502 or network error')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-07` | `click-edit` Toolbar-Button in TOOLS Array (dispatcht `SET_EDIT_MODE` mit `"click-edit"`) | ToolDef | Button-Klick setzt `editMode` auf `"click-edit"` |
| `slice-07` | `SET_EDIT_MODE`, `SET_MASK_DATA` Dispatch-Actions | Reducer Actions | Import via `useCanvasDetail()` |
| `slice-07` | Mask-Upload-Pipeline Pattern (MaskService -> R2) | Pattern | Wiederverwendung fuer Mask-Rendering nach SAM-Response |
| `slice-10` | `POST /api/sam/segment` Endpoint | REST API | `(SAMSegmentRequest) => SAMSegmentResponse` mit HTTP 200/400/422/502 |
| `slice-02` | `CanvasDetailState.editMode`, `maskData`, `currentImageUrl` | State Fields | Lesbar via `useCanvasDetail()` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Click-to-Edit Flow (click -> SAM -> mask -> paint transition) | UI Flow | slice-14 (Keyboard Shortcuts, falls Click-Edit-Shortcuts) | `editMode` State-Transition: `"click-edit"` -> `"inpaint"` |
| SAM Mask als `maskData` im State | ImageData | slice-07 (handleCanvasGenerate nutzt maskData fuer Inpaint) | `dispatch(SET_MASK_DATA, imageData)` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/canvas-detail-view.tsx` -- MODIFY: Click-Handler auf Bild-Area (normalisierte Koordinaten, SAM-API-Call, Loading-State), Confirmation-Dialog bei bestehender Maske, SAM-Mask-zu-MaskCanvas-Rendering, Error-Handling mit Toasts, Crosshair-Cursor bei click-edit Mode, Transition zu Painting-State nach SAM-Erfolg
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderung am SAM API Endpoint (Slice 10)
- KEINE Aenderung an der Floating Brush Toolbar (Slice 04) -- wird nur sichtbar gemacht nach SAM-Erfolg
- KEINE Aenderung am MaskCanvas-Component selbst -- nur Daten hineinladen
- KEINE Keyboard Shortcuts (Slice 14)
- KEIN Erase-Direct-Flow oder Outpaint-Logik
- KEIN neuer Reducer-State -- nutzt bestehende `editMode`, `maskData`, `isProcessing` aus CanvasDetailState

**Technische Constraints:**
- Koordinaten-Berechnung: `offsetX / element.clientWidth` und `offsetY / element.clientHeight` fuer normalisierte 0.0-1.0 Werte
- SAM-API-Call via `fetch('/api/sam/segment', { method: 'POST', body: JSON.stringify(payload) })`
- Mask-PNG laden via `new Image()` + Canvas drawImage -> `getImageData()` -> dispatch als `SET_MASK_DATA`
- Confirmation-Dialog: Bestehende Dialog-Pattern nutzen (AlertDialog aus UI-Library)
- Toast-Meldungen auf Deutsch (konsistent mit architecture.md -> Error Handling Strategy)
- Loading-State als lokaler Component-State (`useState`), NICHT im Reducer

**Reuse (PFLICHT):**

| Existing File | Usage in this Slice |
|---|---|
| `components/canvas/canvas-detail-view.tsx` | MODIFY -- Click-Handler, SAM-Integration, Mask-Rendering, Confirmation-Dialog hinzufuegen |
| `lib/canvas-detail-context.tsx` | IMPORT -- `useCanvasDetail()` fuer `editMode`, `maskData`, `currentImageUrl`, `dispatch` |
| `components/canvas/mask-canvas.tsx` | IMPORT -- MaskCanvas-Ref nutzen um SAM-Mask-Daten zu setzen |
| `components/canvas/floating-brush-toolbar.tsx` | IMPORT -- Wird nach SAM-Erfolg sichtbar (gesteuert durch editMode-Wechsel zu "inpaint") |

**Referenzen:**
- Architecture: `architecture.md` -> API Design, Zeile 80-92 (SAM Endpoint DTOs: SAMSegmentRequest, SAMSegmentResponse)
- Architecture: `architecture.md` -> Migration Map, Zeile 330 (canvas-detail-view Aenderungen)
- Architecture: `architecture.md` -> Business Logic Flow, Zeile 190-199 (SAM Flow)
- Architecture: `architecture.md` -> Error Handling Strategy, Zeile 312-313 (SAM-spezifische Fehler-Toasts)
- Architecture: `architecture.md` -> NFRs, Zeile 392 (SAM Latenz < 5s)
- Wireframes: `wireframes.md` -> Screen "Click-to-Edit Mode" (Crosshair-Cursor, State Variations)
- Discovery: `discovery.md` -> Flow 4: Click-to-Edit, Zeile 145-156 (SAM Auto-Mask Flow + Error Paths)
