# Gate 0: Discovery <-> Wireframe Compliance

**Discovery:** `specs/phase-0/2026-03-02-e2e-generate-persist/discovery.md`
**Wireframes:** `specs/phase-0/2026-03-02-e2e-generate-persist/wireframes.md`
**Pruefdatum:** 2026-03-03

---

## Summary

| Status | Count |
|--------|-------|
| Pass | 38 |
| Auto-Fixed | 4 |
| Blocking | 0 |

**Verdict:** APPROVED

**100% Compliance:** Keine Warnings - alles wird gefixt oder blockiert.

---

## A) Discovery -> Wireframe

### User Flow Coverage

| Discovery Flow | Steps | Wireframe Screens | Status |
|----------------|-------|-------------------|--------|
| Flow 1: Projekt erstellen und Bild generieren | 8 | Project Overview (new project), Workspace (prompt, model, generate), Gallery (placeholder -> image) | Pass |
| Flow 2: Prompt Builder nutzen | 7 | Prompt Builder Drawer (tabs, chips, surprise me, live preview, done) | Pass |
| Flow 3: Prompt verbessern (LLM) | 6 | LLM Prompt Improvement (original, improved, adopt, discard) | Pass |
| Flow 4: Variation erstellen | 6 | Lightbox (variation-btn annotation 8), Workspace (variant-count annotation 9) | Pass |
| Flow 5: Prompt-Baustein erstellen | 5 | My Snippets Tab (new-snippet-btn, snippet-form, snippet-chip) | Pass |
| Flow 5b: Prompt-Baustein bearbeiten/loeschen | 5 | My Snippets Tab (edit/delete icons on hover, form-editing state, confirm-delete state) | Pass |
| Flow 6: Bild herunterladen | 2 | Lightbox (download-btn annotation 7) | Pass |
| Flow 7: Projekt loeschen | 3 | Project Overview (delete-project-btn annotation 4), Confirmation Dialog | Pass |
| Flow 8: Projekt umbenennen | 4 | Project Overview (rename-project-input annotation 3, renaming state) | Pass |
| Error Paths: Generation failed | -- | Workspace state: generation-failed (error icon + retry-btn) | Pass |
| Error Paths: LLM failed | -- | LLM Improvement state: error (Toast + panel closes) | Pass |

### UI State Coverage

| Component | Discovery States | Wireframe States | Missing | Status |
|-----------|------------------|------------------|---------|--------|
| project-card | default, hover, renaming | default (implicit), hover (implicit), renaming (state variation) | -- | Pass |
| model-dropdown | default, open, selected | default, open (implicit), selected (implicit) | -- | Pass |
| prompt-textarea | empty, filled | empty (placeholder text shown), filled (implicit) | -- | Pass |
| negative-prompt-input | hidden, empty, filled | hidden (state: negative-prompt hidden), empty, filled | -- | Pass |
| generate-btn | default, loading | default, loading (generating state: shows spinner) | -- | Pass |
| parameter-panel | loading, ready, empty | loading (state: parameter-panel loading with skeleton), ready, empty (implicit) | -- | Pass |
| gallery-grid | empty, populated | empty (workspace-empty state), populated (workspace with images) | -- | Pass |
| generation-placeholder | loading, failed | loading (skeleton animation), failed (error icon + retry) | -- | Pass |
| lightbox-modal | open, closed | open (full wireframe), closed (implicit) | -- | Pass |
| builder-drawer | open, closed | open (full wireframe), closed (implicit) | -- | Pass |
| llm-comparison | hidden, loading, ready | loading (skeleton/spinner state), ready (both panels), hidden (implicit) | -- | Pass |
| snippet-form | hidden, visible | form-hidden, form-visible, form-editing | -- | Pass |
| snippet-chip | default, selected, hover | default, selected (implicit via toggle), hover (edit/delete icons) | -- | Pass |
| confirm-dialog | open, closed | open (full wireframe), closed (implicit) | -- | Pass |
| download-btn | default, downloading | default, downloading (state: spinner briefly) | -- | Pass |
| delete-generation-btn | default, confirm | default, confirm (confirm-delete state in lightbox) | -- | Pass |
| improve-prompt-btn | default, loading, disabled | default, loading (spinner icon in wireframe), disabled (implicit) | -- | Pass |

### Interactive Elements

| Discovery Element | Wireframe Location | Annotation | Status |
|-------------------|-------------------|------------|--------|
| project-card | Project Overview | Annotation 2 | Pass |
| new-project-btn | Project Overview + Sidebar | Annotation 1 (Overview), Annotation 2 (Sidebar) | Pass |
| project-name-input | Project Overview | Covered by creating state variation | Pass |
| model-dropdown | Workspace | Annotation 3 | Pass |
| prompt-textarea | Workspace | Annotation 4 | Pass |
| negative-prompt-input | Workspace | Annotation 5 | Pass |
| generate-btn | Workspace | Annotation 6 | Pass |
| prompt-builder-btn | Workspace | Annotation 7 | Pass |
| improve-prompt-btn | Workspace | Annotation 8 | Pass |
| variant-count | Workspace | Annotation 9 | Pass |
| parameter-panel | Workspace | Annotation 10 | Pass |
| gallery-grid | Workspace | Annotation 11 | Pass |
| generation-placeholder | Workspace | Covered in generating state | Pass |
| generation-card | Workspace | Part of gallery-grid annotation 11 | Pass |
| retry-btn | Workspace | Covered in generation-failed state | Pass |
| lightbox-modal | Lightbox | Annotation 4 | Pass |
| download-btn | Lightbox | Annotation 7 | Pass |
| variation-btn | Lightbox | Annotation 8 | Pass |
| delete-generation-btn | Lightbox | Annotation 9 | Pass |
| builder-drawer | Prompt Builder | Full screen wireframe | Pass |
| category-tab | Prompt Builder | Annotation 3 | Pass |
| option-chip | Prompt Builder | Annotation 4 | Pass |
| surprise-me-btn | Prompt Builder | Annotation 2 | Pass |
| snippet-form | My Snippets Tab | Annotation 2 | Pass |
| snippet-chip | My Snippets Tab | Annotation 3 | Pass |
| llm-comparison | LLM Improvement | Annotations 1+2 | Pass |
| adopt-btn | LLM Improvement | Annotation 3 | Pass |
| discard-btn | LLM Improvement | Annotation 4 | Pass |
| delete-project-btn | Project Overview | Annotation 4 | Pass |
| confirm-dialog | Confirmation Dialog | Full screen wireframe | Pass |
| sidebar-project-list | Workspace Sidebar | Annotation 1 | Pass |

---

## B) Wireframe -> Discovery (Auto-Fix Rueckfluss)

### Visual Specs - Auto-Fixed

| Wireframe Spec | Value | Discovery Section | Status |
|----------------|-------|-------------------|--------|
| Option-Chip Grid Layout | 3x3 grid per category (9 options) | UI Patterns: "Options-Grid: 3x3 Grid mit Text-Labels pro Kategorie" | Pass (Already Present) |
| Prompt Builder Tabs | Style, Colors, My Snippets | User Flow 2: "Kategorie-Tabs: Style, Colors, Meine Bausteine" | Pass (Already Present) |
| Lightbox Navigation Keyboard | Arrow keys + wrap-around | Feature State Machine: "Prev/Next Chevron-Buttons links/rechts vom Bild + Pfeiltasten", Transition: "Wrap-Around am Ende/Anfang der Galerie" | Pass (Already Present) |
| Parameter Panel Controls | Sliders, Dropdowns, Number Inputs | UI Components: "Dynamisch generierte Controls basierend auf Modell-Schema (Slider, Dropdowns, Number-Inputs)" | Pass (Already Present) |
| Gallery sort order | Newest first | UI Layout: "Neueste oben" | Pass (Already Present) |
| Confirmation Dialog structure | Title + descriptive message + Cancel/Delete buttons | UI Components: confirm-dialog documented | Pass (Already Present) |
| Model dropdown shows price | Model name + price per image | UI Components: "Zeigt Modellname + Preis" | Pass (Already Present) |

### Implicit Constraints - Auto-Fixed

| Wireframe Shows | Implied Constraint | Discovery Section | Status |
|-----------------|-------------------|-------------------|--------|
| `lightbox-prev-btn` as separate component | Prev/Next are distinct clickable buttons, not just keyboard shortcuts | UI Components | Auto-Fixed: lightbox-prev-btn and lightbox-next-btn not listed as separate components in UI Components table |
| `rename-project-input` as separate component | Rename input is a distinct UI element from project-name-input (which is for creation) | UI Components | Auto-Fixed: rename-project-input not listed in UI Components table |
| `new-snippet-btn` as separate component | Button to toggle snippet form visibility is a distinct interactive element | UI Components | Auto-Fixed: new-snippet-btn not listed in UI Components table |
| Confirmation dialog used for Surprise Me | Surprise Me shows confirmation "Replace current selections?" when options already selected | Business Rules | Pass (Already Present: "Falls bereits Optionen ausgewaehlt sind, wird vorher eine Bestaetigung angezeigt") |
| Snippet category dropdown allows new category creation | "select existing or type new" in snippet form | UI Layout: "Dropdown/Input: Kategorie (bestehende waehlen oder neue erstellen)" | Pass (Already Present) |
| LLM error auto-closes panel | Error state: "Panel closes automatically" | Error Paths | Auto-Fixed: Discovery says "Toast: Prompt-Verbesserung fehlgeschlagen, Original bleibt unveraendert" but does not mention panel auto-close behavior |

---

## C) Auto-Fix Summary

### Discovery Updates Needed (Auto-Fixed)

| Section | Content to Add |
|---------|---------------|
| UI Components & States | Add `lightbox-prev-btn` row: `\| lightbox-prev-btn \| Button \| Lightbox \| default \| Vorheriges Bild in Galerie. Auch via linke Pfeiltaste. Wrap-Around am Anfang \|` |
| UI Components & States | Add `lightbox-next-btn` row: `\| lightbox-next-btn \| Button \| Lightbox \| default \| Naechstes Bild in Galerie. Auch via rechte Pfeiltaste. Wrap-Around am Ende \|` |
| UI Components & States | Add `rename-project-input` row: `\| rename-project-input \| Input \| Projekt-Uebersicht, Sidebar \| hidden, visible, saving \| Edit-Icon neben Projektname. Klick macht Namen editierbar (Inline-Input). Enter/Blur speichert \|` |
| UI Components & States | Add `new-snippet-btn` row: `\| new-snippet-btn \| Button \| Builder (Meine Bausteine) \| default \| Toggelt Sichtbarkeit des snippet-form Formulars \|` |
| Error Paths | Update LLM error path to include: "Panel schliesst sich automatisch" |

### Wireframe Updates Needed (Blocking)

None.

---

## Blocking Issues

None.

---

## Verdict

**Status:** APPROVED

**Blocking Issues:** 0
**Required Discovery Updates:** 5
**Required Wireframe Updates:** 0

**Next Steps:**
- [ ] Apply 5 Discovery auto-fix updates (add lightbox-prev-btn, lightbox-next-btn, rename-project-input, new-snippet-btn to UI Components table; update LLM error path description)
