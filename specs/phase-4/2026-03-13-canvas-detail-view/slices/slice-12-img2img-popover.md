# Slice 12: img2img Popover

> **Slice 12 von 18** fuer `Canvas Detail-View & Editing Flow`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-12-img2img-popover` |
| **Test** | `pnpm test components/canvas/__tests__/img2img-popover.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-07-toolbar-ui"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/__tests__/img2img-popover.test.tsx` |
| **Integration Command** | `pnpm tsc --noEmit` |
| **Acceptance Command** | `pnpm test components/canvas/__tests__/img2img-popover.test.tsx` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Grosses schwebendes Popover neben dem img2img-Toolbar-Icon, das das Prompt-Panel-Layout spiegelt (ohne Assistent/Improve und Parameters). Referenz-Bereich mit bis zu 5 Slots (Rollen + Strengths), Prompt-Felder (Motiv + Style/Modifier), Variants-Counter und Generate-Button. Nur UI — Action-Anbindung folgt in Slice 14.

---

## Acceptance Criteria

1) GIVEN `activeToolId` ist `"img2img"` im CanvasDetailContext
   WHEN die Komponente gerendert wird
   THEN erscheint ein Radix Popover neben dem img2img-Toolbar-Icon mit den Sections: References, Prompt, Variants, Generate-Button

2) GIVEN das img2img-Popover ist sichtbar
   WHEN der User in den Referenz-Bereich schaut
   THEN zeigt der Header "REFERENCES" mit einem Counter `[n/5]` wobei n die Anzahl belegter Slots ist

3) GIVEN das img2img-Popover ist sichtbar und weniger als 5 Referenzen sind belegt
   WHEN der User ein Bild per Upload, Drag-and-Drop oder URL-Eingabe in die ImageDropzone legt
   THEN wird ein neuer ReferenceSlot mit Thumbnail, Role-Dropdown (style/content/structure/character/color) und Strength-Dropdown (subtle/moderate/strong/dominant) angezeigt

4) GIVEN ein ReferenceSlot ist belegt
   WHEN der User auf den Remove-Button (x) des Slots klickt
   THEN wird der Slot entfernt und der Counter aktualisiert sich (z.B. `[1/5]` -> `[0/5]`)

5) GIVEN 5 Referenz-Slots sind belegt
   WHEN der User versucht eine weitere Referenz hinzuzufuegen
   THEN ist die Dropzone nicht mehr sichtbar oder deaktiviert

6) GIVEN das img2img-Popover ist sichtbar
   WHEN der User die Prompt-Felder betrachtet
   THEN sind zwei Textareas sichtbar: "Motiv" (required, mit Label und Stern-Markierung) und "Style / Modifier" (optional)

7) GIVEN das img2img-Popover ist sichtbar
   WHEN der User Text in das Motiv-Feld tippt
   THEN wird der eingegebene Text im internen State gespeichert und ist editierbar

8) GIVEN das img2img-Popover ist sichtbar
   WHEN der User den Variants-Counter betrachtet
   THEN zeigt er einen numerischen Wert mit [-] und [+] Buttons, Bereich 1-4, Default 1

9) GIVEN der Variants-Counter steht auf 1
   WHEN der User [-] klickt
   THEN bleibt der Wert bei 1 (Minimum)

10) GIVEN der Variants-Counter steht auf 4
    WHEN der User [+] klickt
    THEN bleibt der Wert bei 4 (Maximum)

11) GIVEN das img2img-Popover ist sichtbar
    WHEN der User den Generate-Button betrachtet
    THEN ist ein Button mit Label "Generate" sichtbar (noch ohne Action-Anbindung, ruft `onGenerate`-Callback auf)

12) GIVEN `activeToolId` wechselt von `"img2img"` zu `null`
    WHEN das Popover-State sich aendert
    THEN schliesst das Popover

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/__tests__/img2img-popover.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Img2imgPopover', () => {
  // AC-1: Popover erscheint bei activeToolId "img2img"
  it.todo('should render popover with References, Prompt, Variants and Generate sections when activeToolId is "img2img"')

  // AC-2: Reference-Counter zeigt n/5
  it.todo('should display reference counter as [n/5] reflecting occupied slots')

  // AC-3: Referenz hinzufuegen erzeugt Slot mit Role/Strength
  it.todo('should add a reference slot with role and strength dropdowns when image is added')

  // AC-4: Referenz entfernen aktualisiert Counter
  it.todo('should remove reference slot and update counter when remove button is clicked')

  // AC-5: Maximum 5 Referenzen
  it.todo('should prevent adding more than 5 references')

  // AC-6: Zwei Prompt-Felder sichtbar
  it.todo('should render Motiv textarea as required and Style/Modifier textarea as optional')

  // AC-7: Motiv-Feld editierbar
  it.todo('should update internal state when user types in Motiv field')

  // AC-8: Variants-Counter mit +/- Buttons
  it.todo('should render variants counter with minus and plus buttons, default value 1')

  // AC-9: Variants-Minimum bei 1
  it.todo('should not decrease variants below 1')

  // AC-10: Variants-Maximum bei 4
  it.todo('should not increase variants above 4')

  // AC-11: Generate-Button vorhanden
  it.todo('should render Generate button that calls onGenerate callback when clicked')

  // AC-12: Popover schliesst bei Deaktivierung
  it.todo('should close popover when activeToolId changes away from "img2img"')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-03-canvas-detail-context` | `useCanvasDetail()` | React Hook | `state.activeToolId`, `dispatch({ type: 'SET_ACTIVE_TOOL' })` |
| `slice-07-toolbar-ui` | `activeToolId` State-Changes | Context Dispatch | Popover oeffnet/schliesst basierend auf `activeToolId === "img2img"` |
| Existing | `ReferenceBar` | React Component | `components/workspace/reference-bar.tsx` — Slots, Rollen, Strengths |
| Existing | `ReferenceSlot` | React Component | `components/workspace/reference-slot.tsx` — Thumbnail, Role/Strength Dropdowns |
| Existing | `ImageDropzone` | React Component | `components/workspace/image-dropzone.tsx` — Upload, Drag, URL |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `Img2imgPopover` | React Component | `slice-14` (Generation-Flow) | `<Img2imgPopover generation={Generation} onGenerate={(params: Img2imgParams) => void} />` |
| `Img2imgParams` | TypeScript Type | `slice-14` | `{ references: ReferenceInput[], motiv: string, style: string, variants: number }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/popovers/img2img-popover.tsx` -- Grosses Popover mit Referenz-Bereich (ReferenceBar/ReferenceSlot/ImageDropzone wiederverwendet), Prompt-Felder (Motiv + Style/Modifier), Variants-Counter (+/-), Generate-Button
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Server-Action-Anbindung (Generate-Button ruft nur `onGenerate`-Callback auf, Slice 14 verbindet)
- KEIN Model-Selector im Popover (Model kommt aus Header-Selector, siehe Slice 14)
- KEINE Assistent/Improve-Buttons (Chat-Panel uebernimmt diese Rolle)
- KEINE Parameter-Section (Steps, CFG etc. — nicht im img2img-Popover)
- KEIN Loading-State innerhalb des Popovers (Popover schliesst vor Generation-Start)

**Technische Constraints:**
- `"use client"` Direktive
- Radix UI Popover (via `components/ui/popover.tsx`, existiert im Projekt)
- ReferenceBar/ReferenceSlot/ImageDropzone aus `components/workspace/` wiederverwenden
- Rollen: `style | content | structure | character | color` (existierende `ReferenceRole` Type)
- Strengths: `subtle | moderate | strong | dominant` (existierende Werte)

**Referenzen:**
- Wireframes: `wireframes.md` -> "Screen: img2img Popover" fuer Layout und Annotationen
- Discovery: `discovery.md` -> "UI Components & States" -> `popover.img2img` fuer States und Verhalten
- Architecture: `architecture.md` -> Section "Files to Keep" fuer wiederverwendbare Komponenten
