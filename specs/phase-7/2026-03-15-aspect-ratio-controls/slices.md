# Slice Decomposition

**Feature:** Model Parameter Controls (Aspect Ratio, Size & Advanced)
**Discovery-Slices:** 4 grobe Slices
**Atomare Slices:** 7 nach Decomposition
**Stack:** TypeScript (Next.js 16.1.6, React 19.2.3, Vitest 4.0.18)

---

## Dependency Graph

```
slice-01 (resolveModel Utility)
    |
    +---> slice-02 (useModelSchema Hook)
    |         |
    |         +---> slice-03 (ParameterPanel Primary/Advanced Split)
    |                   |
    |                   +---> slice-04 (Prompt Panel: imageParams State + ParameterPanel Mount)
    |                   |         |
    |                   |         +---> slice-05 (Prompt Panel: imageParams Merge in handleGenerate)
    |                   |
    |                   +---> slice-06 (Canvas Popovers: ParameterPanel Mount + imageParams State)
    |                                 |
    |                                 +---> slice-07 (Canvas Popovers: imageParams Merge in Handlers)
```

---

## Slice-Liste

### Slice 1: resolveModel Utility extrahieren

- **Scope:** Die inline `resolveModel()`-Funktion aus `prompt-area.tsx:128-141` in ein shared Utility extrahieren. Identische Signatur, reiner Funktions-Export. Import in `prompt-area.tsx` auf das neue Utility umstellen.
- **Deliverables:**
  - `lib/utils/resolve-model.ts` (neu)
  - `lib/utils/resolve-model.test.ts` (neu)
  - `components/workspace/prompt-area.tsx` (Aenderung: inline-Funktion entfernen, Import hinzufuegen)
- **Done-Signal:** Unit-Tests fuer `resolveModel` bestehen (findet Setting nach mode+tier, gibt undefined bei fehlendem Setting zurueck). `prompt-area.tsx` kompiliert ohne Fehler mit dem neuen Import.
- **Dependencies:** []
- **Discovery-Quelle:** Slice 1 "useModelSchema Hook + resolveModel Utility"

---

### Slice 2: useModelSchema Hook

- **Scope:** React Hook erstellen, der `getModelSchema` Server Action aufruft. Verwaltet `schema`, `isLoading`, `error` State. Refetcht bei `modelId`-Aenderung. Gibt `null` fuer `undefined` modelId zurueck.
- **Deliverables:**
  - `lib/hooks/use-model-schema.ts` (neu)
  - `lib/hooks/use-model-schema.test.ts` (neu)
- **Done-Signal:** Unit-Tests bestehen: Hook gibt Schema zurueck bei gueltigem modelId, zeigt Loading-State, handled Fehler graceful (error statt throw), gibt null-Schema bei undefined modelId zurueck.
- **Dependencies:** ["slice-01"]
- **Discovery-Quelle:** Slice 1 "useModelSchema Hook + resolveModel Utility"

---

### Slice 3: ParameterPanel Primary/Advanced Split

- **Scope:** Bestehende `ParameterPanel`-Komponente erweitern: (1) `primaryFields` Whitelist-Prop hinzufuegen, (2) erweiterte `INTERNAL_FIELDS`-Ausschlussliste (prompt, image-input, img2img, inpainting, backend-only, API-Keys), (3) Type-Filter (string ohne enum, boolean, array ohne enum ausschliessen), (4) Rendering aufteilen in Primary (immer sichtbar) und Advanced (Collapsible), (5) Aspect-Ratio-Gruppierung bei >8 enum-Werten (Common vs. Extreme mit Separator).
- **Deliverables:**
  - `components/workspace/parameter-panel.tsx` (Aenderung)
  - `components/workspace/parameter-panel.test.tsx` (Aenderung/Erweiterung)
- **Done-Signal:** Unit-Tests bestehen: Primary-Fields (aspect_ratio, megapixels, resolution) oben gerendert wenn in Schema vorhanden. Advanced-Fields eingeklappt per Default, nach Toggle-Klick sichtbar. INTERNAL_FIELDS (prompt, image, seed, num_outputs etc.) nicht gerendert. Type-Filter greifen. Aspect-Ratio mit >8 Werten zeigt Separator zwischen Common- und Extreme-Gruppe.
- **Dependencies:** ["slice-02"]
- **Discovery-Quelle:** Slice 2 "ParameterPanel Primary/Advanced Split"

---

### Slice 4: Prompt Panel -- imageParams State + ParameterPanel Mount

- **Scope:** In `prompt-area.tsx`: (1) `imageParams` Feld zu `Txt2ImgState` und `Img2ImgState` hinzufuegen, (2) `useModelSchema` Hook einbinden mit resolved modelId, (3) ParameterPanel zwischen TierToggle und Variants-Stepper rendern, (4) imageParams bei Model-Wechsel (Tier-Aenderung) zuruecksetzen. Nur UI-Mounting, noch kein Merge in handleGenerate.
- **Deliverables:**
  - `components/workspace/prompt-area.tsx` (Aenderung)
- **Done-Signal:** Manueller Test: In txt2img- und img2img-Mode erscheinen Primary Controls (Aspect Ratio, Megapixels/Resolution je nach Model) zwischen TierToggle und Variants. Advanced Toggle ist sichtbar und klappbar. Skeleton wird waehrend Schema-Loading gezeigt. Tier-Wechsel laedt neues Schema und setzt Werte zurueck.
- **Dependencies:** ["slice-03"]
- **Discovery-Quelle:** Slice 3 "Prompt Panel Controls"

---

### Slice 5: Prompt Panel -- imageParams Merge in handleGenerate

- **Scope:** In `prompt-area.tsx`: imageParams aus dem Mode-State in die `generateImages()`-Aufrufe (handleGenerate) einmergen. `params: { ...modelParams, ...imageParams }` fuer txt2img und img2img.
- **Deliverables:**
  - `components/workspace/prompt-area.tsx` (Aenderung)
- **Done-Signal:** Manueller Test: Generierung mit gewaehltem Aspect Ratio (z.B. "16:9") erzeugt ein Bild im korrekten Format. In den Generation-Details (modelParams) ist der gewaehlte Wert sichtbar.
- **Dependencies:** ["slice-04"]
- **Discovery-Quelle:** Slice 3 "Prompt Panel Controls"

---

### Slice 6: Canvas Popovers -- ParameterPanel Mount + imageParams State

- **Scope:** In `variation-popover.tsx` und `img2img-popover.tsx`: (1) `useModelSchema` Hook mit resolved modelId einbinden (modelSettings als Prop von canvas-detail-view), (2) lokalen `imageParams` State hinzufuegen, (3) ParameterPanel zwischen TierToggle/MaxQualityToggle und Generate-Button rendern, (4) `imageParams` Feld zu `VariationParams` und `Img2imgParams` Interfaces hinzufuegen, (5) imageParams in `onGenerate`-Callback mitgeben.
- **Deliverables:**
  - `components/canvas/popovers/variation-popover.tsx` (Aenderung)
  - `components/canvas/popovers/img2img-popover.tsx` (Aenderung)
- **Done-Signal:** Manueller Test: Variation-Popover und Img2img-Popover zeigen Primary Controls + Advanced Toggle. Schema-Loading zeigt Skeleton. Tier-Wechsel laedt neues Schema.
- **Dependencies:** ["slice-03"]
- **Discovery-Quelle:** Slice 4 "Canvas Popover Controls"

---

### Slice 7: Canvas Popovers -- imageParams Merge in canvas-detail-view Handlers

- **Scope:** In `canvas-detail-view.tsx`: (1) `handleVariationGenerate` erweitern -- `params.imageParams` in das params-Objekt spreaden neben `prompt_strength`, (2) `handleImg2imgGenerate` erweitern -- `params.imageParams` in das params-Objekt spreaden.
- **Deliverables:**
  - `components/canvas/canvas-detail-view.tsx` (Aenderung)
- **Done-Signal:** Manueller Test: Canvas Variation mit gewaehltem Aspect Ratio generiert Bild im korrekten Format. Canvas Img2img mit gewaehlten Params (z.B. resolution "2K") generiert entsprechend.
- **Dependencies:** ["slice-06"]
- **Discovery-Quelle:** Slice 4 "Canvas Popover Controls"

---

## Flow-Traceability

| Discovery-Slice | Integration-Testfall | Abgedeckt in Slice | Done-Signal |
|-----------------|----------------------|--------------------|-------------|
| Slice 1 "useModelSchema Hook + resolveModel Utility" | Unit Test: Hook gibt Schema zurueck, cached, handled Fehler | Slice 1 (resolveModel Unit Tests) + Slice 2 (useModelSchema Unit Tests) | Unit-Tests bestehen |
| Slice 2 "ParameterPanel Primary/Advanced Split" | Unit Test: Primary-Fields oben, Advanced eingeklappt, Toggle funktioniert | Slice 3 (ParameterPanel Unit Tests) | Unit-Tests bestehen: Primary oben, Advanced collapsed, Toggle funktioniert |
| Slice 3 "Prompt Panel Controls" | Manuell: txt2img/img2img -> Primary-Dropdowns sichtbar, Advanced einklappbar, Generierung mit gewaehlten Params | Slice 4 (UI Mount) + Slice 5 (Merge in handleGenerate) | Slice 4: Controls sichtbar + interaktiv. Slice 5: Generierung mit gewaehlten Params erzeugt korrektes Bild |
| Slice 4 "Canvas Popover Controls" | Manuell: Popovers zeigen Primary + Advanced Controls, Generierung mit gewaehlten Params | Slice 6 (UI Mount) + Slice 7 (Merge in Handlers) | Slice 6: Controls in Popovers sichtbar. Slice 7: Canvas-Generierung mit gewaehlten Params erzeugt korrektes Bild |

---

## Qualitaets-Checkliste

- [x] Jeder Slice hat maximal 3 produktive Deliverable-Dateien
- [x] Jeder Slice hat ein messbares Done-Signal
- [x] Dependencies sind azyklisch (DAG)
- [x] Alle Deliverables aus der Discovery sind abgedeckt (nichts vergessen)
- [x] Kein Slice hat mehr als ein Concern (DB+UI = zu viel)
- [x] Schema/Service-Slices kommen vor UI-Slices
- [x] Stack ist korrekt erkannt und dokumentiert
- [x] Flow-Completeness: Jeder Integration-Testfall aus Discovery-Testability hat einen zugehoerigen Slice mit passendem Done-Signal (Regel 7)
