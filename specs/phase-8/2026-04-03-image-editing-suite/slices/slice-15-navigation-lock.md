# Slice 15: Navigation Lock & State Cleanup

> **Slice 15 von 16** fuer `AI Image Editing Suite`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-15-navigation-lock` |
| **Test** | `pnpm test components/canvas/__tests__/canvas-navigation-lock.test.tsx components/canvas/__tests__/canvas-toolbar-mutual-exclusion.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-07-inpaint-integration"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/__tests__/canvas-navigation-lock.test.tsx components/canvas/__tests__/canvas-toolbar-mutual-exclusion.test.tsx` |
| **Integration Command** | -- |
| **Acceptance Command** | `pnpm test -- --run` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (CanvasDetailContext gemockt) |

---

## Ziel

Prev/Next-Navigation blockieren wenn eine Maske im State existiert, damit der User nicht versehentlich ungesicherte Maskierungsarbeit verliert. Toolbar-Mutual-Exclusion sicherstellen: Klick auf ein Toggle-Tool (Details, Variation, img2img, Upscale) waehrend ein Edit-Modus aktiv ist deaktiviert den Edit-Modus, blendet Mask-Canvas aus, behaelt aber die Maske im State. Mask-Canvas-Visibility wird an `editMode` gekoppelt.

---

## Acceptance Criteria

1) GIVEN `maskData` ist eine gueltige `ImageData`-Instanz im State (Maske wurde gemalt)
   WHEN die `CanvasNavigation`-Komponente rendert
   THEN sind Prev- und Next-Buttons visuell disabled (`opacity-50`, `pointer-events-none`)
   AND Klick auf Prev/Next fuehrt NICHT zu `SET_CURRENT_IMAGE` Dispatch
   AND Arrow-Key-Navigation (Left/Right) ist unterdrueckt

2) GIVEN `maskData` ist `null` im State (keine Maske vorhanden)
   WHEN die `CanvasNavigation`-Komponente rendert
   THEN sind Prev- und Next-Buttons normal klickbar (wie bisher)
   AND Arrow-Key-Navigation funktioniert wie bisher

3) GIVEN `editMode` ist `"inpaint"` (Brush Edit aktiv, Mask-Canvas sichtbar)
   WHEN der User auf den Toggle-Button `variation` in der Toolbar klickt
   THEN wird `SET_ACTIVE_TOOL` mit `"variation"` dispatched
   AND `editMode` wird auf `null` gesetzt (Edit-Modus deaktiviert)
   AND `maskData` bleibt unveraendert im State (Maske NICHT geloescht)

4) GIVEN `editMode` ist `"erase"` (Erase-Modus aktiv)
   WHEN der User auf den Toggle-Button `details` klickt
   THEN wird `editMode` auf `null` gesetzt
   AND `activeToolId` wechselt auf `"details"`
   AND `maskData` bleibt im State erhalten

5) GIVEN `editMode` war `"inpaint"`, User hat zu `variation` gewechselt (AC-3), Maske existiert noch im State
   WHEN der User zurueck auf `brush-edit` klickt
   THEN wird `editMode` auf `"inpaint"` gesetzt
   AND Mask-Canvas wird wieder sichtbar (da `editMode !== null` und maskData vorhanden)
   AND die zuvor gemalte Maske ist vollstaendig erhalten

6) GIVEN `editMode` ist `null` (kein Edit-Modus aktiv)
   WHEN die `canvas-detail-view` rendert
   THEN ist das Mask-Canvas-Element nicht sichtbar (`display: none` oder nicht gemountet)
   AND die Floating Brush Toolbar ist nicht sichtbar

7) GIVEN `editMode` ist `"inpaint"` oder `"erase"`
   WHEN die `canvas-detail-view` rendert
   THEN ist das Mask-Canvas-Element sichtbar
   AND die Floating Brush Toolbar ist sichtbar

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/__tests__/canvas-navigation-lock.test.tsx`

<test_spec>
```typescript
// AC-1: Navigation disabled wenn Maske existiert
it.todo('should disable prev/next buttons and suppress arrow keys when maskData exists')

// AC-2: Navigation normal wenn keine Maske
it.todo('should enable prev/next buttons and arrow keys when maskData is null')
```
</test_spec>

### Test-Datei: `components/canvas/__tests__/canvas-toolbar-mutual-exclusion.test.tsx`

<test_spec>
```typescript
// AC-3: Variation-Klick bei aktivem Edit-Modus deaktiviert editMode, behaelt Maske
it.todo('should deactivate editMode and keep maskData when clicking variation during inpaint mode')

// AC-4: Details-Klick bei aktivem Erase-Modus deaktiviert editMode
it.todo('should deactivate editMode and switch to details tool when clicking details during erase mode')

// AC-5: Rueckwechsel zu brush-edit stellt Maske wieder her
it.todo('should restore mask visibility when switching back to brush-edit after tool switch')

// AC-6: Mask-Canvas hidden wenn editMode null
it.todo('should hide mask canvas and floating brush toolbar when editMode is null')

// AC-7: Mask-Canvas sichtbar wenn editMode inpaint oder erase
it.todo('should show mask canvas and floating brush toolbar when editMode is inpaint or erase')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-02` | `CanvasDetailState.editMode`, `maskData`, `SET_EDIT_MODE` Action | State + Action | `editMode` ist `string \| null`, `maskData` ist `ImageData \| null` |
| `slice-02` | `SET_ACTIVE_TOOL` Action (bestehendes Pattern) | Action | Reducer setzt `activeToolId` |
| `slice-03` | `MaskCanvas` Component | Component | Gemountet in canvas-detail-view, Visibility steuerbar |
| `slice-04` | `FloatingBrushToolbar` Component | Component | Gemountet in canvas-detail-view, Visibility steuerbar |
| `slice-07` | 4 Toolbar-Buttons (`brush-edit`, `erase`, `click-edit`, `expand`) | ToolDef[] | In TOOLS Array mit `toggle: true` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Navigation-Lock-Logik | Prop/Bedingung | -- (Final-Slice) | `disabled` Prop auf CanvasNavigation basierend auf `maskData !== null` |
| Mutual-Exclusion-Pattern | Reducer-Logik | -- (Final-Slice) | `SET_ACTIVE_TOOL` bei non-edit Tool setzt `editMode = null`, behaelt `maskData` |
| Mask-Canvas Visibility-Kopplung | Render-Bedingung | -- (Final-Slice) | Mask-Canvas + Floating Toolbar nur sichtbar wenn `editMode` in `["inpaint", "erase"]` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/canvas-detail-view.tsx` -- Navigation-Lock: `disabled`-Prop an CanvasNavigation basierend auf `maskData !== null`. Mask-Canvas + FloatingBrushToolbar Visibility an `editMode` koppeln
- [ ] `components/canvas/canvas-toolbar.tsx` -- Mutual-Exclusion: Bei Klick auf non-edit Toggle-Tool waehrend `editMode !== null` zusaetzlich `SET_EDIT_MODE` mit `null` dispatchen. Maske bleibt im State
- [ ] `components/canvas/canvas-navigation.tsx` -- `disabled` Prop akzeptieren, Buttons disabled rendern und Arrow-Key-Handler unterdruecken wenn `true`
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen am CanvasDetailContext-Reducer (der `SET_EDIT_MODE` Action und `maskData`-Feld sind bereits in Slice 02 definiert)
- KEINE Mask-Persistierung oder Serialisierung (Masken bleiben session-only)
- KEINE Keyboard Shortcuts fuer Brush-Controls (Keyboard Shortcuts & Mask Undo ist ein separater Slice)
- KEIN Confirmation-Dialog bei Navigation (Buttons werden einfach disabled, kein "Maske verwerfen?"-Dialog)
- `CanvasNavigation` wird NUR um ein `disabled`-Prop erweitert -- keine Logik-Aenderungen an der Navigation-Reihenfolge oder dem Index-Handling

**Technische Constraints:**
- `CanvasNavigation` bekommt ein neues `disabled`-Prop -- wenn `true`, werden Buttons disabled gerendert und Arrow-Key-Handler ignoriert
- Mutual Exclusion nutzt bestehendes `SET_ACTIVE_TOOL` Pattern: Reducer setzt `activeToolId`. Der Toolbar-Handler dispatcht zusaetzlich `SET_EDIT_MODE` mit `null` wenn ein non-edit Toggle-Tool geklickt wird und `editMode !== null`
- Mask-Canvas Visibility: `editMode` bestimmt ob MaskCanvas und FloatingBrushToolbar im JSX gerendert werden (conditional rendering oder CSS `hidden`)
- Toast-Meldungen auf Deutsch (konsistent mit architecture.md Error Handling Strategy)

**Reuse (PFLICHT):**

| Existing File | Usage in this Slice |
|---|---|
| `components/canvas/canvas-detail-view.tsx` | MODIFY -- `disabled`-Prop an CanvasNavigation, Conditional Rendering fuer MaskCanvas + FloatingBrushToolbar |
| `components/canvas/canvas-toolbar.tsx` | MODIFY -- `handleToolClick` um Mutual-Exclusion-Dispatch erweitern |
| `components/canvas/canvas-navigation.tsx` | MODIFY -- `disabled` Prop akzeptieren, Buttons + Arrow-Keys deaktivieren wenn `true` |
| `lib/canvas-detail-context.tsx` | IMPORT -- `useCanvasDetail()` fuer `editMode`, `maskData`, `dispatch` |

**Referenzen:**
- Architecture: `architecture.md` Zeile 360 -- Constraint "Existing SET_ACTIVE_TOOL toggle pattern must be preserved"
- Architecture: `architecture.md` Zeile 394 -- NFR "Mask persists across tool switches"
- Discovery: `discovery.md` Frage 27 -- "Navigation blockieren bei aktiver Maske"
- Discovery: `discovery.md` Zeile 253 -- Transition "Klick auf Toggle-Tool waehrend Edit-Modus aktiv"
- Discovery: `discovery.md` Zeile 285 -- "Mask-Sichtbarkeit: Mask-Canvas nur sichtbar in Modi die Masken nutzen"
- Discovery: `discovery.md` Zeile 303 -- "Toolbar Mutual Exclusion: nur ein activeToolId gleichzeitig"
- Wireframes: `wireframes.md` Zeile 409 -- State Variation "result (navigation blocked)"
