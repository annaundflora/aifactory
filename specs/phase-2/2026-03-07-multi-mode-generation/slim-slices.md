# Slim Slice Decomposition

**Feature:** Multi-Mode Generation (img2img + Upscale)
**Discovery-Slices:** 6
**Atomare Slices:** 16
**Stack:** TypeScript / Next.js (App Router, Server Actions, Drizzle ORM, Vitest)

---

## Dependency Graph

```
slice-01 (DB Schema)
    │
    ├──► slice-02 (DB Queries)
    │        │
    │        ├──► slice-03 (Generation Service img2img)
    │        │        │
    │        │        └──► slice-05 (generateImages Action)
    │        │
    │        └──► slice-04 (Generation Service upscale)
    │                 │
    │                 └──► slice-06 (upscaleImage Action)
    │
    ├──► slice-07 (Storage Client contentType)
    │
    └──► slice-08 (uploadSourceImage Action)
             │
             └──► (slice-05, slice-06 nutzen uploadSourceImage intern)

slice-09 (WorkspaceState Extension)
    │
    └──► slice-15 (Lightbox Cross-Mode Buttons)

slice-10 (ModeSelector Component)
    │
    └──► slice-11 (PromptArea Refactoring)
             │
             ├──► slice-12 (ImageDropzone Component)
             │        │
             │        └──► slice-11 (integriert Dropzone)
             │
             ├──► slice-13 (StrengthSlider Component)
             │
             └──► slice-11 (nutzt slice-05, slice-06 fuer Submit)

slice-14 (FilterChips + ModeBadge)
    │
    └──► slice-16 (GalleryGrid + WorkspaceContent Filter)

slice-15 (Lightbox Cross-Mode Buttons)
    │
    └──► (nutzt slice-09 WorkspaceState)
```

**Vereinfacht — kritischer Pfad:**

```
slice-01 → slice-02 → slice-03 → slice-05
                    → slice-04 → slice-06
slice-07 → slice-08
slice-10 → slice-11 (integriert slice-12, slice-13)
slice-09 → slice-15
slice-14 → slice-16
```

---

## Slice-Liste

### Slice 1: DB Schema — Neue Spalten in generations

- **Scope:** Drizzle-Schema um `generationMode`, `sourceImageUrl`, `sourceGenerationId` erweitern. Migration generieren. Vorhandene Zeilen erhalten `generationMode = 'txt2img'` als Default.
- **Deliverables:**
  - `lib/db/schema.ts` (3 neue Spalten + Self-Ref-FK + Composite-Index)
  - `drizzle/migrations/XXXX_add_generation_mode.sql` (auto-generiert via drizzle-kit)
- **Done-Signal:** `lib/db/__tests__/schema-generations.test.ts` passt (Schema-Test erkennt neue Spalten); `npx drizzle-kit generate` laeuft ohne Fehler; bestehende Migrations-Tests bleiben gruen.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 3 "img2img Generation" (DB-Schema-Teil)

---

### Slice 2: DB Queries — createGeneration fuer neue Felder

- **Scope:** `createGeneration`-Query-Funktion akzeptiert die drei neuen Felder. Kein Breaking Change — alle neuen Felder optional mit Default.
- **Deliverables:**
  - `lib/db/queries.ts` (Eingabe-Typ + INSERT erweitert)
  - `lib/db/__tests__/queries.test.ts` (Tests fuer neue Felder)
- **Done-Signal:** Unit-Test verifiziert, dass `createGeneration({ generationMode: "img2img", sourceImageUrl: "...", ... })` den korrekten Record einfuegt; bestehende Query-Tests bleiben gruen.
- **Dependencies:** ["slice-01"]
- **Discovery-Quelle:** Slice 3 "img2img Generation" (DB-Schema-Teil)

---

### Slice 3: Storage Client — dynamischer ContentType

- **Scope:** `lib/clients/storage.ts` `upload()`-Methode bekommt optionalen `contentType`-Parameter. Default bleibt `image/png` (kein Breaking Change). Source-Images koennen als `image/jpeg`, `image/webp` etc. hochgeladen werden.
- **Deliverables:**
  - `lib/clients/storage.ts` (Parameter hinzugefuegt)
  - `lib/clients/__tests__/storage.test.ts` (Test fuer dynamischen ContentType)
- **Done-Signal:** Test bestaetigt, dass `upload({ contentType: "image/jpeg" })` den korrekten `ContentType`-Header setzt; bestehender Test mit Default `image/png` bleibt gruen.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 2 "Image Upload (Dropzone + R2)"

---

### Slice 4: Model Schema Service — supportsImg2Img Helper

- **Scope:** `lib/services/model-schema-service.ts` um `supportsImg2Img(modelId)`-Methode erweitern. Prueft ob Schema `image`, `image_prompt` oder `init_image` Parameter hat. Nutzt bestehenden Cache.
- **Deliverables:**
  - `lib/services/model-schema-service.ts` (neue Methode)
  - `lib/services/__tests__/model-schema-service.test.ts` (Tests fuer Helper)
- **Done-Signal:** Tests bestaetigen: Modell mit `image`-Parameter → `true`; Modell ohne → `false`; gecachte Schema-Daten werden wiederverwendet (kein zweiter API-Call).
- **Dependencies:** []
- **Discovery-Quelle:** Slice 3 "img2img Generation" (Modell-Kompatibilitaet)

---

### Slice 5: Models — UPSCALE_MODEL Konstante

- **Scope:** `lib/models.ts` um `UPSCALE_MODEL`-Konstante erweitern (`nightmareai/real-esrgan`). Kein Einfluss auf bestehende MODELS-Liste.
- **Deliverables:**
  - `lib/models.ts` (neue Konstante)
  - `lib/__tests__/models.test.ts` (Test fuer Konstante)
- **Done-Signal:** Test bestaetigt, dass `UPSCALE_MODEL` den korrekten Replicate-Model-String enthaelt; bestehende MODELS-Array-Tests bleiben unveraendert.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 4 "Upscale Modus + Lightbox-Aktion"

---

### Slice 6: Generation Service — img2img Erweiterung

- **Scope:** `lib/services/generation-service.ts` `generate()`-Methode und `buildReplicateInput()` um img2img-Felder erweitern: `generationMode`, `sourceImageUrl`, `strength`. Schema-getriebene Erkennung des korrekten Replicate-Parameternamens (`image` / `image_prompt` / `init_image`).
- **Deliverables:**
  - `lib/services/generation-service.ts` (generate + buildReplicateInput erweitert)
  - `lib/services/__tests__/generation-service.test.ts` (img2img-Testfaelle)
- **Done-Signal:** Unit-Tests bestaetigen: img2img-Input enthaelt `image` + `prompt_strength`; generationMode wird in createGeneration uebergeben; bestehende txt2img-Tests bleiben gruen.
- **Dependencies:** ["slice-01", "slice-02", "slice-04"]
- **Discovery-Quelle:** Slice 3 "img2img Generation"

---

### Slice 7: Generation Service — upscale() Methode

- **Scope:** `lib/services/generation-service.ts` neue `upscale()`-Methode: verwendet `UPSCALE_MODEL`, generiert Prompt-String ("Upscale {scale}x" oder mit Original-Prompt), erstellt 1 Generation mit `generationMode = "upscale"`.
- **Deliverables:**
  - `lib/services/generation-service.ts` (neue upscale()-Methode)
  - `lib/services/__tests__/generation-service.test.ts` (upscale-Testfaelle)
- **Done-Signal:** Tests bestaetigen: `upscale({ scale: 2 })` → Replicate-Call mit `nightmareai/real-esrgan`; Prompt = "Upscale 2x"; mit `sourceGenerationId` → Prompt = "{originalPrompt} (Upscale 2x)"; immer genau 1 Generation.
- **Dependencies:** ["slice-02", "slice-05"]
- **Discovery-Quelle:** Slice 4 "Upscale Modus + Lightbox-Aktion"

---

### Slice 8: Server Action — uploadSourceImage

- **Scope:** Neue Server Action `uploadSourceImage` in `app/actions/generations.ts`. Validiert Dateityp (PNG/JPG/JPEG/WebP), Groesse (max 10MB). Laedt zu R2 unter `sources/{projectId}/{uuid}.{ext}` hoch. Nutzt `SourceImageService` (inline oder als Helper, keine neue Service-Datei noetig).
- **Deliverables:**
  - `app/actions/generations.ts` (neue Action hinzugefuegt)
  - `app/actions/__tests__/generations.test.ts` (Tests fuer uploadSourceImage)
- **Done-Signal:** Tests bestaetigen: gueltiges PNG → R2-URL zurueck; falsche Dateiextension → `{ error: "Nur PNG, JPG, JPEG und WebP erlaubt" }`; > 10MB → `{ error: "Datei darf maximal 10MB gross sein" }`.
- **Dependencies:** ["slice-03"]
- **Discovery-Quelle:** Slice 2 "Image Upload (Dropzone + R2)"

---

### Slice 9: Server Action — generateImages img2img + upscaleImage

- **Scope:** `app/actions/generations.ts` `generateImages`-Action um img2img-Felder erweitern (`generationMode`, `sourceImageUrl`, `strength`). Neue `upscaleImage`-Action hinzufuegen. Validierung fuer beide Modes.
- **Deliverables:**
  - `app/actions/generations.ts` (generateImages erweitert + upscaleImage neu)
  - `app/actions/__tests__/generations.test.ts` (Validierungs-Tests)
- **Done-Signal:** Tests bestaetigen: img2img ohne sourceImageUrl → Validierungsfehler; strength ausserhalb [0,1] → Fehler; scale != 2|4 → Fehler; gueltiger img2img-Input → delegiert an GenerationService; gueltiger upscale-Input → delegiert an GenerationService.upscale().
- **Dependencies:** ["slice-06", "slice-07", "slice-08"]
- **Discovery-Quelle:** Slice 3 "img2img Generation", Slice 4 "Upscale"

---

### Slice 10: WorkspaceState Extension

- **Scope:** `lib/workspace-state.tsx` `WorkspaceVariationState`-Interface um `targetMode`, `sourceImageUrl`, `strength`, `sourceGenerationId` erweitern. Context-Provider und Hook unveraendert, nur Typ-Erweiterung.
- **Deliverables:**
  - `lib/workspace-state.tsx` (Interface erweitert)
  - `lib/__tests__/workspace-state.test.ts` (Tests fuer neue Felder)
- **Done-Signal:** Tests bestaetigen: State mit `targetMode: "img2img"` und `sourceImageUrl` setzbar und auslesbar; bestehende Variation-Tests bleiben gruen.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 6 "Cross-Mode Lightbox-Interaktionen"

---

### Slice 11: ModeSelector Component

- **Scope:** Neue Komponente `components/workspace/mode-selector.tsx` — Segmented Control mit drei Segmenten (Text to Image / Image to Image / Upscale). Kontrolliert von aussen (`value` + `onChange`). Rein presentational.
- **Deliverables:**
  - `components/workspace/mode-selector.tsx` (neue Komponente)
  - `components/workspace/__tests__/mode-selector.test.tsx` (Render- und Klick-Tests)
- **Done-Signal:** Tests bestaetigen: aktives Segment ist visuell markiert; Klick auf anderes Segment ruft `onChange` mit korrektem Modus auf; alle drei Segmente rendern.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 1 "Mode-Selector + Prompt-Area Refactoring"

---

### Slice 12: ImageDropzone Component

- **Scope:** Neue Komponente `components/workspace/image-dropzone.tsx`. States: empty (Dashed), drag-over, uploading (Progress), preview (Thumbnail + Filename + Dimensionen + Remove), error. Drag & Drop + Click-to-Browse + URL-Paste. Ruft `uploadSourceImage`-Action auf. Gibt R2-URL via `onUpload`-Callback zurueck.
- **Deliverables:**
  - `components/workspace/image-dropzone.tsx` (neue Komponente)
  - `components/workspace/__tests__/image-dropzone.test.tsx` (State-Transitions-Tests)
- **Done-Signal:** Tests bestaetigen: empty-State zeigt Dropzone-Text; nach erfolgreichem Upload wird Preview-State mit Thumbnail gerendert; Remove-Button versetzt Komponente in empty-State; Upload-Fehler zeigt error-State; Generate-Button (extern) ist disabled solange kein preview-State.
- **Dependencies:** ["slice-08"]
- **Discovery-Quelle:** Slice 2 "Image Upload (Dropzone + R2)"

---

### Slice 13: StrengthSlider Component

- **Scope:** Neue Komponente `components/workspace/strength-slider.tsx`. Slider 0.0–1.0 mit klickbaren Preset-Buttons (Subtle=0.3, Balanced=0.6, Creative=0.85). Zeigt aktuellen Wert an. Kontrolliert von aussen (`value` + `onChange`).
- **Deliverables:**
  - `components/workspace/strength-slider.tsx` (neue Komponente)
  - `components/workspace/__tests__/strength-slider.test.tsx` (Preset- und Slider-Tests)
- **Done-Signal:** Tests bestaetigen: Klick auf "Balanced" setzt Wert 0.6 und ruft `onChange(0.6)` auf; Klick auf "Subtle" → 0.3; aktuell aktiver Preset ist visuell markiert; Default-Wert 0.6 wird korrekt angezeigt.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 3 "img2img Generation" (Strength-Slider-Teil)

---

### Slice 14: PromptArea Refactoring — Mode-Awareness

- **Scope:** `components/workspace/prompt-area.tsx` um ModeSelector, ImageDropzone und StrengthSlider erweitern. Konditionelles Rendering nach Modus. Per-Modus-State-Objekte (State Persistence Matrix). Model-Auto-Switch bei img2img wenn inkompatibel. Upscale-Modus: Prompt/Model/Variants ausgeblendet, Button-Label "Upscale". Reagiert auf WorkspaceState-Aenderungen (Cross-Mode).
- **Deliverables:**
  - `components/workspace/prompt-area.tsx` (erweitert)
  - `components/workspace/__tests__/prompt-area.test.tsx` (Mode-Switch-Tests)
- **Done-Signal:** Tests bestaetigen: Wechsel zu img2img zeigt Dropzone + StrengthSlider; Wechsel zu upscale blendet Prompt-Felder aus; Wechsel zurueck zu txt2img stellt eingegebenen Prompt wieder her (State Persistence); WorkspaceState mit `targetMode: "img2img"` setzt Modus und Source-Image korrekt.
- **Dependencies:** ["slice-09", "slice-10", "slice-11", "slice-12", "slice-13"]
- **Discovery-Quelle:** Slice 1 "Mode-Selector + Prompt-Area Refactoring"

---

### Slice 15: FilterChips Component + ModeBadge Component

- **Scope:** Neue Komponente `components/workspace/filter-chips.tsx` — Toggle-Gruppe mit Alle/Text to Image/Image to Image/Upscale (Single-Select). Neue Komponente `components/workspace/mode-badge.tsx` — kleines Badge "T"/"I"/"U" als Overlay auf Generation-Cards.
- **Deliverables:**
  - `components/workspace/filter-chips.tsx` (neue Komponente)
  - `components/workspace/mode-badge.tsx` (neue Komponente)
  - `components/workspace/__tests__/filter-chips.test.tsx` (Toggle-Tests)
- **Done-Signal:** Tests bestaetigen: Klick auf "Image to Image" markiert diesen Chip und deaktiviert andere; `onChange`-Callback wird mit korrektem Filterwert aufgerufen; ModeBadge rendert "T" fuer txt2img, "I" fuer img2img, "U" fuer upscale.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 5 "Galerie Filter-Chips + Mode Badges"

---

### Slice 16: GalleryGrid + GenerationCard + WorkspaceContent — Filter + Badge Integration

- **Scope:** `components/workspace/gallery-grid.tsx` akzeptiert `modeFilter`-Prop und filtert client-seitig nach `generationMode`. `components/workspace/generation-card.tsx` zeigt ModeBadge-Overlay. `components/workspace/workspace-content.tsx` haelt Filter-State und rendert FilterChips ueber Gallery.
- **Deliverables:**
  - `components/workspace/gallery-grid.tsx` (modeFilter-Prop)
  - `components/workspace/generation-card.tsx` (ModeBadge-Integration)
  - `components/workspace/workspace-content.tsx` (FilterChips + filter-State)
- **Done-Signal:** Tests bestaetigen: GalleryGrid mit `modeFilter="img2img"` rendert nur img2img-Generierungen; GenerationCard zeigt korrektes ModeBadge; leerer Filter-Result zeigt "No Image to Image generations yet"; Alle-Filter zeigt alle Generierungen.
- **Dependencies:** ["slice-01", "slice-15"]
- **Discovery-Quelle:** Slice 5 "Galerie Filter-Chips + Mode Badges"

---

### Slice 17: Lightbox — Cross-Mode Buttons (img2img + Upscale Popover)

- **Scope:** `components/lightbox/lightbox-modal.tsx` um "img2img"-Button und "Upscale"-Button mit Popover (2x/4x) erweitern. Modus-abhaengige Button-Sichtbarkeit (upscale-Bild: kein Re-Upscale, keine Variation). img2img-Button setzt WorkspaceState. Upscale-Button ruft `upscaleImage`-Action auf und zeigt Toast. Variation-Button bei img2img-Bildern laedt Original-Source-Image. Shadcn Popover-Komponente installieren.
- **Deliverables:**
  - `components/lightbox/lightbox-modal.tsx` (neue Buttons + Popover + Variation-Anpassung)
  - `components/lightbox/__tests__/lightbox-modal.test.tsx` (Cross-Mode-Tests)
- **Done-Signal:** Tests bestaetigen: txt2img-Bild in Lightbox → img2img-Button + Upscale-Button sichtbar; Klick auf img2img-Button → WorkspaceState wird mit `targetMode: "img2img"` und `sourceImageUrl` gesetzt; Klick auf "2x" im Popover → `upscaleImage`-Action aufgerufen; upscale-Bild → Variation + Upscale-Button ausgeblendet; img2img-Variation → `sourceImageUrl` des Originals wird gesetzt.
- **Dependencies:** ["slice-09", "slice-10"]
- **Discovery-Quelle:** Slice 4 "Upscale Modus + Lightbox-Aktion", Slice 6 "Cross-Mode Lightbox-Interaktionen"

---

## Abdeckungs-Mapping Discovery → Atomare Slices

| Discovery-Slice | Atomare Slices |
|-----------------|----------------|
| Slice 1: Mode-Selector + Prompt-Area Refactoring | slice-11 (ModeSelector), slice-14 (PromptArea Refactoring) |
| Slice 2: Image Upload (Dropzone + R2) | slice-03 (Storage contentType), slice-08 (uploadSourceImage Action), slice-12 (ImageDropzone Component) |
| Slice 3: img2img Generation | slice-01 (DB Schema), slice-02 (DB Queries), slice-04 (ModelSchemaService Helper), slice-06 (GenerationService img2img), slice-09 (generateImages Action), slice-13 (StrengthSlider) |
| Slice 4: Upscale Modus + Lightbox-Aktion | slice-05 (UPSCALE_MODEL), slice-07 (GenerationService upscale), slice-09 (upscaleImage Action), slice-17 (Lightbox Upscale Popover) |
| Slice 5: Galerie Filter-Chips + Mode Badges | slice-15 (FilterChips + ModeBadge), slice-16 (GalleryGrid + WorkspaceContent) |
| Slice 6: Cross-Mode Lightbox-Interaktionen | slice-10 (WorkspaceState Extension), slice-17 (Lightbox Cross-Mode Buttons) |

---

## Qualitaets-Checkliste

- [x] Jeder Slice hat maximal 3 produktive Deliverable-Dateien
- [x] Jeder Slice hat ein messbares Done-Signal (Test-Kriterium)
- [x] Dependencies sind azyklisch (DAG)
- [x] Alle Deliverables aus der Discovery sind abgedeckt (nichts vergessen)
- [x] Kein Slice hat mehr als ein Concern (DB+UI = zu viel)
- [x] Schema/Service-Slices kommen vor UI-Slices
- [x] Stack ist korrekt erkannt und dokumentiert (TypeScript / Next.js / Vitest)
