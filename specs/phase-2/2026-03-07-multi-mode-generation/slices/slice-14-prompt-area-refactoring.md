# Slice 14: PromptArea Refactoring — Mode-Awareness

> **Slice 14 von N** für `Multi-Mode Generation (img2img + Upscale)`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-14-prompt-area-refactoring` |
| **Test** | `pnpm test components/workspace/__tests__/prompt-area.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-09-action-generate-upscale", "slice-10-workspace-state-extension", "slice-11-mode-selector-component", "slice-12-image-dropzone-component", "slice-13-strength-slider-component"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/__tests__/prompt-area.test.tsx` |
| **Integration Command** | `pnpm test components/workspace/__tests__/` |
| **Acceptance Command** | — |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (`generateImages`, `upscaleImage` via `vi.mock('@/app/actions/generations')`; `ModeSelector`, `ImageDropzone`, `StrengthSlider` als echte Komponenten; `useWorkspaceVariation` via `vi.mock('@/lib/workspace-state')`) |

---

## Ziel

`components/workspace/prompt-area.tsx` wird zur orchestrierenden Komponente: Sie integriert `ModeSelector`, `ImageDropzone` und `StrengthSlider`, verwaltet per-Modus-State-Objekte (State Persistence Matrix), blendet Felder modus-abhängig ein/aus und reagiert auf `WorkspaceVariationState`-Änderungen für Cross-Mode-Flows aus der Lightbox.

---

## Acceptance Criteria

1) GIVEN `PromptArea` im Standard-Zustand (kein WorkspaceState gesetzt)
   WHEN die Komponente gerendert wird
   THEN ist `ModeSelector` oben sichtbar mit aktivem Segment `"txt2img"`; `ImageDropzone` und `StrengthSlider` sind nicht im DOM; Prompt-Felder, Model-Selector, Variants und der Button mit Label "Generate" sind sichtbar

2) GIVEN `PromptArea` im `txt2img`-Modus
   WHEN der Nutzer auf das Segment "Image to Image" klickt
   THEN wechselt `ModeSelector` zu aktivem Segment `"img2img"`; `ImageDropzone` und `StrengthSlider` erscheinen im DOM; Prompt-Felder, Model-Selector, Variants und Button "Generate" bleiben sichtbar

3) GIVEN `PromptArea` im `txt2img`-Modus
   WHEN der Nutzer auf das Segment "Upscale" klickt
   THEN wechselt `ModeSelector` zu aktivem Segment `"upscale"`; `ImageDropzone` erscheint; Prompt-Felder, `StrengthSlider`, Model-Selector und Variants sind nicht im DOM; der Button-Label ist "Upscale"

4) GIVEN `PromptArea` im `img2img`-Modus mit eingegebenem Prompt-Motiv "sunset landscape"
   WHEN der Nutzer auf das Segment "Text to Image" klickt und dann zurück auf "Image to Image"
   THEN ist das Prompt-Motiv-Feld wieder mit "sunset landscape" befüllt (State Persistence — Wert wurde nicht zerstört)

5) GIVEN `PromptArea` im `upscale`-Modus mit eingegebenem Prompt-Motiv "ocean waves" (im txt2img-State gespeichert)
   WHEN der Nutzer auf das Segment "Text to Image" klickt
   THEN ist das Prompt-Motiv-Feld mit "ocean waves" befüllt (Restore aus txt2img-State)

6) GIVEN `PromptArea` im `img2img`-Modus mit gesetztem `sourceImageUrl` "https://r2.example.com/sources/p1/img.png"
   WHEN der Nutzer auf das Segment "Upscale" klickt und dann zurück auf "Image to Image"
   THEN ist `ImageDropzone` mit `initialUrl="https://r2.example.com/sources/p1/img.png"` gerendert (Source-Image-Transfer und Restore)

7) GIVEN `PromptArea` im `txt2img`-Modus und `useWorkspaceVariation` gibt `{ targetMode: "img2img", sourceImageUrl: "https://r2.example.com/sources/p1/abc.png", promptMotiv: "lighthouse", modelId: "flux-pro" }` zurück
   WHEN der WorkspaceVariationState sich ändert (Cross-Mode aus Lightbox)
   THEN wechselt der Modus zu `"img2img"`; `ImageDropzone` ist mit `initialUrl="https://r2.example.com/sources/p1/abc.png"` gerendert; das Prompt-Motiv-Feld zeigt "lighthouse"

8) GIVEN `PromptArea` im `img2img`-Modus ohne gesetztes Source-Image (`ImageDropzone` im `empty`-State)
   WHEN der Nutzer auf den Generate-Button klickt
   THEN wird `generateImages` nicht aufgerufen; der Button bleibt disabled (kein Source-Image vorhanden)

9) GIVEN `PromptArea` im `img2img`-Modus mit Source-Image `"https://r2.example.com/sources/p1/img.png"` und Prompt-Motiv "sunset", Strength 0.6
   WHEN der Nutzer auf "Generate" klickt
   THEN wird `generateImages` einmal aufgerufen mit `generationMode: "img2img"`, `sourceImageUrl: "https://r2.example.com/sources/p1/img.png"` und `strength: 0.6`

10) GIVEN `PromptArea` im `upscale`-Modus mit Source-Image `"https://r2.example.com/sources/p1/img.png"` und Scale 2x (Default)
    WHEN der Nutzer auf "Upscale" klickt
    THEN wird `upscaleImage` einmal aufgerufen mit `sourceImageUrl: "https://r2.example.com/sources/p1/img.png"` und `scale: 2`

11) GIVEN `PromptArea` im `upscale`-Modus ohne gesetztes Source-Image
    WHEN der Nutzer auf den "Upscale"-Button klickt
    THEN wird `upscaleImage` nicht aufgerufen; der Button bleibt disabled

12) GIVEN `PromptArea` im `txt2img`-Modus mit aktivem Modell das kein img2img unterstützt
    WHEN der Nutzer auf das Segment "Image to Image" klickt
    THEN wird automatisch auf das erste img2img-kompatible Modell aus `MODELS` gewechselt; ein Toast "Model switched to {displayName} (supports img2img)" wird angezeigt

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Tests mocken `generateImages` und `upscaleImage` via `vi.mock('@/app/actions/generations')`. `useWorkspaceVariation` wird via `vi.mock('@/lib/workspace-state')` gemockt um Cross-Mode-State zu simulieren. Echte Sub-Komponenten (`ModeSelector`, `ImageDropzone`, `StrengthSlider`) werden eingebunden.

### Test-Datei: `components/workspace/__tests__/prompt-area.test.tsx`

<test_spec>
```typescript
// AC-1: txt2img Default — ModeSelector aktiv, Dropzone/Slider nicht im DOM, Button "Generate"
it.todo('should render txt2img mode by default with ModeSelector, prompt fields and Generate button')

// AC-2: Wechsel zu img2img — Dropzone + StrengthSlider erscheinen, Prompt bleibt
it.todo('should show ImageDropzone and StrengthSlider when switching to img2img mode')

// AC-3: Wechsel zu upscale — nur Dropzone, Prompt/Model/Variants ausgeblendet, Button "Upscale"
it.todo('should show only ImageDropzone and Upscale button when switching to upscale mode')

// AC-4: State Persistence — Prompt bleibt bei Moduswechsel txt2img → img2img → txt2img
it.todo('should restore prompt motiv after switching modes away and back to img2img')

// AC-5: State Persistence Restore — txt2img-Prompt wird bei Wechsel upscale → txt2img wiederhergestellt
it.todo('should restore txt2img prompt when switching from upscale back to txt2img')

// AC-6: Source-Image Transfer — img2img sourceImageUrl bleibt bei Wechsel img2img → upscale → img2img
it.todo('should transfer and restore sourceImageUrl when switching between img2img and upscale modes')

// AC-7: Cross-Mode WorkspaceState — targetMode: "img2img" setzt Modus und Source-Image und Prompt
it.todo('should switch to img2img mode and prefill sourceImageUrl and prompt from WorkspaceVariationState')

// AC-8: Generate disabled ohne Source-Image im img2img-Modus
it.todo('should not call generateImages when Generate button is clicked without source image in img2img mode')

// AC-9: generateImages aufgerufen mit korrekten img2img-Parametern
it.todo('should call generateImages with generationMode img2img, sourceImageUrl and strength')

// AC-10: upscaleImage aufgerufen mit sourceImageUrl und scale 2
it.todo('should call upscaleImage with sourceImageUrl and scale 2 in upscale mode')

// AC-11: Upscale disabled ohne Source-Image
it.todo('should not call upscaleImage when Upscale button is clicked without source image')

// AC-12: Model Auto-Switch bei img2img mit inkompatiblem Modell
it.todo('should auto-switch model and show toast when switching to img2img with incompatible current model')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-09-action-generate-upscale` | `generateImages`, `upscaleImage` | Server Actions | Signaturen: `generateImages(input: GenerateImagesInput)`, `upscaleImage({ projectId, sourceImageUrl, scale })` |
| `slice-10-workspace-state-extension` | `useWorkspaceVariation` | Hook | Liefert `{ variationData: WorkspaceVariationState \| null, clearVariation }` inkl. `targetMode`, `sourceImageUrl`, `strength` |
| `slice-11-mode-selector-component` | `ModeSelector` | Component | `({ value, onChange, disabledModes? }) => JSX.Element` |
| `slice-12-image-dropzone-component` | `ImageDropzone` | Component | `({ projectId, onUpload, initialUrl? }) => JSX.Element` |
| `slice-13-strength-slider-component` | `StrengthSlider` | Component | `({ value, onChange }) => JSX.Element` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `PromptArea` (erweitert) | Component | `workspace-content.tsx` | Unverändertes Interface nach aussen — interne Erweiterung |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/prompt-area.tsx` — Erweitert um `ModeSelector`, `ImageDropzone`, `StrengthSlider`-Integration; per-Modus-State-Objekte (State Persistence Matrix); konditionelles Rendering nach Modus; Model-Auto-Switch bei img2img; WorkspaceVariationState-Reaktion für Cross-Mode-Flows; Button-Label kontextabhängig ("Generate" / "Upscale")
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt `components/workspace/__tests__/prompt-area.test.tsx` basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Kein neues Routing, keine neuen API-Routen
- Kein ScaleSelector — Scale wird innerhalb von `PromptArea` als lokaler Toggle implementiert (kein eigener Slice)
- Keine Lightbox-Buttons (img2img-Button, Upscale-Popover) — das ist Scope eines späteren Slice
- Keine Gallery-FilterChips — separater Slice
- `ModeSelector`, `ImageDropzone` und `StrengthSlider` werden nicht modifiziert

**Technische Constraints:**
- Per-Modus-State als einzelnes `modeStates`-Objekt im React-Component-State (nicht im Context) — Struktur: siehe `architecture.md` → Section "State Persistence Matrix (Mode Switch)"
- Cross-Mode via `useWorkspaceVariation`: Nach Verarbeitung muss `clearVariation` aufgerufen werden um Loop zu verhindern
- Model-Auto-Switch nutzt `ModelSchemaService.supportsImg2Img()` (Server Action oder cached) — kein direktes Replicate-Fetch im Client
- `"use client"` Direktive — bestehende Direktive bleibt unverändert
- Toast für Model-Auto-Switch via Sonner (`toast("Model switched to {displayName} (supports img2img)")`)
- Button disabled-Logik: img2img → disabled wenn `sourceImageUrl === null`; upscale → disabled wenn `sourceImageUrl === null`

**Referenzen:**
- Element-Reihenfolge pro Modus: `discovery.md` → Section "UI Layout & Context" → "Prompt-Area (linkes Panel)"
- State Persistence Matrix: `architecture.md` → Section "State Persistence Matrix (Mode Switch)"
- Model Auto-Switch: `architecture.md` → Section "Model Auto-Switch (Client-Side)"
- Cross-Mode Contract: `architecture.md` → Section "State Persistence Matrix" → "Cross-Mode (Lightbox)"
- Wireframes pro Modus: `wireframes.md` → Sections "Prompt Area — Text to Image", "Image to Image", "Upscale Mode", "Cross-Mode Transition"
