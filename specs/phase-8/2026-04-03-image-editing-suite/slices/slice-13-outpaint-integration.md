# Slice 13: Outpaint Chat Integration & Canvas Extension

> **Slice 13 von 16** fuer `AI Image Editing Suite`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-13-outpaint-integration` |
| **Test** | `pnpm test components/canvas/__tests__/canvas-detail-view-outpaint.test.tsx components/canvas/__tests__/canvas-chat-panel-outpaint.test.tsx lib/services/__tests__/generation-service-outpaint.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-07-inpaint-integration", "slice-12-outpaint-controls"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/__tests__/canvas-detail-view-outpaint.test.tsx components/canvas/__tests__/canvas-chat-panel-outpaint.test.tsx lib/services/__tests__/generation-service-outpaint.test.ts` |
| **Integration Command** | -- |
| **Acceptance Command** | `pnpm test -- --run` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (generateImages, sharp, R2 Upload, Replicate API gemockt) |

---

## Ziel

Outpaint End-to-End verdrahten: (1) `OutpaintControls` in `canvas-detail-view.tsx` mounten wenn `editMode === "outpaint"`, (2) `handleCanvasGenerate` im Chat-Panel um den `action="outpaint"` Branch erweitern, der `outpaintDirections` und `outpaintSize` an `generateImages()` uebergibt und den Send-Button disabled wenn keine Richtung gewaehlt ist, (3) `buildReplicateInput()` im GenerationService um serverseitige Canvas-Extension via `sharp` (Bild + transparentes Padding) und automatische Mask-Generierung fuer den erweiterten Bereich erweitern.

---

## Acceptance Criteria

1) GIVEN `editMode` ist `"outpaint"` im Canvas Detail Context
   WHEN `canvas-detail-view.tsx` gerendert wird
   THEN wird `<OutpaintControls />` im Center-Column sichtbar gerendert
   AND `<MaskCanvas />` und `<FloatingBrushToolbar />` werden NICHT gerendert

2) GIVEN `editMode` ist NICHT `"outpaint"` (z.B. `"inpaint"` oder `null`)
   WHEN `canvas-detail-view.tsx` gerendert wird
   THEN wird `<OutpaintControls />` NICHT gerendert

3) GIVEN `editMode` ist `"outpaint"` und `outpaintDirections` ist `[]` (leer)
   WHEN das Chat-Panel gerendert wird
   THEN ist der Send-Button disabled
   AND ein Inline-Hinweis "Waehle mindestens eine Richtung zum Erweitern" wird angezeigt

4) GIVEN ein SSE-Event mit `action: "outpaint"` trifft in `handleCanvasGenerate` ein
   AND `outpaintDirections` ist `["top", "right"]` und `outpaintSize` ist `50`
   WHEN der Handler ausgefuehrt wird
   THEN wird `generateImages()` aufgerufen mit `generationMode: "outpaint"`, `sourceImageUrl`, `outpaintDirections: ["top", "right"]`, `outpaintSize: 50`

5) GIVEN `generateImages()` wird mit `generationMode: "outpaint"` aufgerufen
   WHEN `buildReplicateInput()` im GenerationService ausgefuehrt wird
   THEN wird das Source-Bild serverseitig via `sharp` um transparentes Padding in den angegebenen Richtungen erweitert (Padding-Groesse = `outpaintSize`% der Original-Dimension)
   AND eine Mask-PNG wird generiert: schwarz fuer den Original-Bildbereich, weiss fuer den erweiterten Bereich
   AND das erweiterte Bild + Mask + Prompt werden an die Replicate API (FLUX Fill Pro) uebergeben

6) GIVEN `outpaintDirections` ist `["left"]` und `outpaintSize` ist `100` und das Bild ist 1024x1024
   WHEN `buildReplicateInput()` ausgefuehrt wird
   THEN ist das erweiterte Bild 2048x1024 (1024px Padding links)
   AND die Mask ist 2048x1024 mit schwarzem Bereich rechts (1024x1024) und weissem Bereich links (1024x1024)

7) GIVEN `outpaintDirections` ist `["top", "bottom"]` und `outpaintSize` ist `50` und das Bild ist 1024x1024
   WHEN `buildReplicateInput()` ausgefuehrt wird
   THEN ist das erweiterte Bild 1024x1536 (512px oben + 512px unten)

8) GIVEN die berechneten Dimensionen nach Canvas-Extension wuerden 2048px in einer Dimension ueberschreiten
   WHEN `handleCanvasGenerate` mit `action: "outpaint"` ausgefuehrt wird
   THEN wird ein Toast "Bild wuerde API-Limit ueberschreiten" angezeigt
   AND `generateImages()` wird NICHT aufgerufen

9) GIVEN `generateImages()` mit `generationMode: "outpaint"` wurde erfolgreich ausgefuehrt und Polling liefert ein Ergebnis
   WHEN das Ergebnis-Bild vorliegt
   THEN wird `PUSH_UNDO` mit dem aktuellen Bild dispatched
   AND `SET_CURRENT_IMAGE` mit der neuen (erweiterten) Bild-URL dispatched

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/__tests__/canvas-detail-view-outpaint.test.tsx`

<test_spec>
```typescript
// AC-1: OutpaintControls wird gerendert wenn editMode === "outpaint"
it.todo('should render OutpaintControls when editMode is outpaint')

// AC-2: OutpaintControls wird NICHT gerendert bei anderem editMode
it.todo('should not render OutpaintControls when editMode is not outpaint')
```
</test_spec>

### Test-Datei: `components/canvas/__tests__/canvas-chat-panel-outpaint.test.tsx`

<test_spec>
```typescript
// AC-3: Send-Button disabled und Hinweis bei leeren outpaintDirections
it.todo('should disable send button and show hint when outpaintDirections is empty in outpaint mode')

// AC-4: handleCanvasGenerate uebergibt outpaintDirections und outpaintSize an generateImages
it.todo('should call generateImages with outpaint mode and direction/size params on outpaint action')

// AC-8: Toast bei Ueberschreitung der Max-Dimensionen
it.todo('should show toast and skip generation when outpaint would exceed 2048px limit')

// AC-9: PUSH_UNDO und SET_CURRENT_IMAGE nach erfolgreichem Outpaint-Ergebnis
it.todo('should dispatch PUSH_UNDO and SET_CURRENT_IMAGE after successful outpaint result')
```
</test_spec>

### Test-Datei: `lib/services/__tests__/generation-service-outpaint.test.ts`

<test_spec>
```typescript
// AC-5: buildReplicateInput erstellt erweiterten Canvas + Mask via sharp
it.todo('should extend image with transparent padding and generate mask for outpaint mode')

// AC-6: Korrekte Dimensionen bei einseitiger Erweiterung (left, 100%)
it.todo('should produce 2048x1024 image with 1024px left padding for 1024x1024 source')

// AC-7: Korrekte Dimensionen bei zweiseitiger Erweiterung (top+bottom, 50%)
it.todo('should produce 1024x1536 image with 512px top and bottom padding for 1024x1024 source')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-07` | `handleCanvasGenerate` mit action-Switch Pattern | Function | Handler akzeptiert `action: "outpaint"` als neuen Branch |
| `slice-07` | `SSECanvasGenerateEvent` mit `outpaint_directions`, `outpaint_size` | Type | Felder werden korrekt geparsed |
| `slice-07` | Mask-Upload-Pipeline (R2 Upload Pattern) | Pattern | Gleiche Upload-Logik wiederverwendbar fuer generierte Outpaint-Mask |
| `slice-12` | `OutpaintControls` Component | React Component | `<OutpaintControls />` — liest Context intern |
| `slice-02` | `outpaintDirections`, `outpaintSize`, `editMode` | State-Felder | Lesbar via `useCanvasDetail()` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `handleCanvasGenerate` outpaint-Branch | Function | -- (letzter Consumer) | Vollstaendiger Outpaint-Flow im action-Switch |
| `buildReplicateInput` outpaint-Branch | Function | -- (letzter Consumer) | Canvas-Extension + Mask-Generierung via `sharp` |
| `OutpaintControls` gemountet | Component Mount | -- | Sichtbar in canvas-detail-view wenn editMode === "outpaint" |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/canvas-detail-view.tsx` — MODIFY: `OutpaintControls` im Center-Column mounten wenn `editMode === "outpaint"`, bedingt MaskCanvas/FloatingBrushToolbar ausblenden
- [ ] `components/canvas/canvas-chat-panel.tsx` — MODIFY: `handleCanvasGenerate` um `action="outpaint"` Branch erweitern, Send-Button-Disable-Logik bei leeren Directions, Dimensions-Pre-Validation
- [ ] `lib/services/generation-service.ts` — MODIFY: `buildReplicateInput()` um outpaint-Branch mit `sharp`-Canvas-Extension (transparentes Padding) und automatischer Mask-Generierung (schwarz=original, weiss=erweitert)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderung an `outpaint-controls.tsx` (bereits in Slice 12 fertig)
- KEINE Aenderung an `canvas-detail-context.tsx` (State/Actions bereits in Slice 02)
- KEINE Aenderung an `canvas-chat-service.ts` (SSE-Parsing bereits in Slice 07)
- KEIN Instruction-Editing, Inpaint- oder Erase-Logik (andere Slices)
- KEIN Keyboard-Shortcut-Handling

**Technische Constraints:**
- Canvas-Extension via `sharp` ist serverseitig (in `buildReplicateInput()` innerhalb GenerationService)
- Padding-Berechnung: `paddingPx = Math.round(originalDimension * (outpaintSize / 100))` pro Richtung
- Mask-Generierung: Programmatisch via `sharp` — schwarzes Rechteck an Originalposition, weisser Hintergrund fuer Erweiterung
- Max-Dimensions-Check: Ergebnis-Breite und -Hoehe duerfen jeweils 2048px nicht ueberschreiten (FLUX Fill Pro Limit)
- Inline-Hinweis-Text auf Deutsch: "Waehle mindestens eine Richtung zum Erweitern"
- Toast-Meldungen auf Deutsch (konsistent mit architecture.md → Error Handling Strategy)
- Outpaint nutzt gleichen FLUX Fill Pro Slot wie Inpaint (Slot-Resolution via `resolveSlotForMode("outpaint")`)

**Reuse (PFLICHT):**

| Existing File | Usage in this Slice |
|---|---|
| `components/canvas/canvas-detail-view.tsx` | MODIFY — OutpaintControls mounten, bedingte Rendering-Logik |
| `components/canvas/canvas-chat-panel.tsx` | MODIFY — outpaint-Branch in handleCanvasGenerate, Send-Button-Logik |
| `lib/services/generation-service.ts` | MODIFY — buildReplicateInput outpaint-Branch mit sharp |
| `components/canvas/outpaint-controls.tsx` | IMPORT — Component aus Slice 12, unveraendert |
| `lib/canvas-detail-context.tsx` | IMPORT — useCanvasDetail() fuer outpaintDirections, outpaintSize, editMode |

**Referenzen:**
- Architecture: `architecture.md` → Server Logic Zeile 148 (buildReplicateInput outpaint: extended-image+mask+prompt)
- Architecture: `architecture.md` → Integrations Zeile 373-374 (Outpainting via FLUX Fill Pro, sharp fuer Canvas-Extension)
- Architecture: `architecture.md` → Migration Map Zeile 330 (canvas-detail-view mountet outpaint-controls)
- Architecture: `architecture.md` → Migration Map Zeile 331 (canvas-chat-panel outpaint Branch)
- Architecture: `architecture.md` → Migration Map Zeile 334 (generation-service outpaint Branch)
- Architecture: `architecture.md` → Validation Rules Zeile 209-210 (outpaintDirections/outpaintSize Validierung)
- Architecture: `architecture.md` → Error Handling Zeile 317 (Image size exceeds API limit)
- Architecture: `architecture.md` → NFRs Zeile 398 (Max Image Size, FLUX Fill Pro ~2048x2048 Limit)
- Wireframes: `wireframes.md` → Outpaint Mode (Zeile 260-308)
- Wireframes: `wireframes.md` → Generating State (Zeile 358: direction controls hidden during generation)
- Discovery: `discovery.md` → Flow 5: Outpainting (Zeile 158-169)
