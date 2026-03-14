# E2E Checklist: Model Handling Redesign -- Draft/Quality Tier System

**Integration Map:** `integration-map.md`
**Generated:** 2026-03-14

---

## Pre-Conditions

- [x] All slices APPROVED (Gate 2) -- 13/13 APPROVED
- [x] Architecture APPROVED (Gate 1)
- [x] Integration Map has no MISSING INPUTS -- 0 gaps

---

## Happy Path Tests

### Flow 1: Generation mit Draft (Default)

1. [ ] **Slice 01:** `model_settings` Tabelle existiert mit 8 Seed-Eintraegen
2. [ ] **Slice 06:** Workspace oeffnen -- TierToggle sichtbar mit "Draft" aktiv
3. [ ] **Slice 06:** MaxQualityToggle ist NICHT sichtbar (Draft Modus)
4. [ ] **Slice 07:** Prompt eingeben, Generate klicken
5. [ ] **Slice 07:** `generateImages` wird mit `modelIds: ["black-forest-labs/flux-schnell"]` aufgerufen
6. [ ] **Slice 07:** Bild erscheint in Gallery, `generations.modelId` = `"black-forest-labs/flux-schnell"`

### Flow 2: Wechsel zu Quality + Max Quality

1. [ ] **Slice 06:** Auf "Quality" im TierToggle klicken
2. [ ] **Slice 06:** TierToggle zeigt "Quality" aktiv, MaxQualityToggle erscheint (off)
3. [ ] **Slice 07:** Generate klicken -- `modelIds: ["black-forest-labs/flux-2-pro"]`
4. [ ] **Slice 06:** MaxQualityToggle aktivieren (on)
5. [ ] **Slice 07:** Generate klicken -- `modelIds: ["black-forest-labs/flux-2-max"]`
6. [ ] **Slice 06:** Zurueck auf "Draft" klicken -- MaxQualityToggle verschwindet

### Flow 3: Settings konfigurieren

1. [ ] **Slice 04:** Settings-Icon (Gear) im Workspace Header sichtbar
2. [ ] **Slice 04:** Klick auf Settings-Icon -- Modal "Model Settings" oeffnet sich
3. [ ] **Slice 04:** 3 Sections sichtbar: TEXT TO IMAGE (3 Dropdowns), IMAGE TO IMAGE (3 Dropdowns), UPSCALE (2 Dropdowns)
4. [ ] **Slice 04:** Dropdowns zeigen aktuelle Model-Zuweisungen (Seed-Defaults)
5. [ ] **Slice 04:** Dropdown oeffnen -- Collection-Models mit Name + Owner sichtbar
6. [ ] **Slice 04:** img2img-Section: inkompatible Models ausgegraut
7. [ ] **Slice 04:** Kompatibles Model in txt2img/Draft auswaehlen -- Auto-Save (updateModelSetting aufgerufen)
8. [ ] **Slice 04:** Dialog schliessen und erneut oeffnen -- neue Auswahl persistiert
9. [ ] **Slice 04:** ESC druecken oder ausserhalb klicken -- Dialog schliesst

### Flow 4: Canvas Iteration (Variation Popover)

1. [ ] **Slice 08:** Canvas Detail View oeffnen -- `getModelSettings()` wird aufgerufen
2. [ ] **Slice 09:** Variation-Tool auswaehlen -- Popover zeigt TierToggle (Draft aktiv)
3. [ ] **Slice 09:** Auf Quality wechseln -- MaxQualityToggle erscheint
4. [ ] **Slice 09:** Generate klicken -- `VariationParams.tier = "quality"`, Model aus img2img/quality Settings
5. [ ] **Slice 09:** Img2Img-Popover oeffnen -- eigener TierToggle auf Draft (unabhaengig von Variation)

### Flow 4b: Canvas Iteration (Upscale Popover)

1. [ ] **Slice 10:** Upscale-Tool auswaehlen -- Popover zeigt TierToggle (Draft aktiv)
2. [ ] **Slice 10:** Kein MaxQualityToggle sichtbar (Upscale hat kein Max)
3. [ ] **Slice 10:** "2x Upscale" klicken -- `onUpscale({ scale: 2, tier: "draft" })`, Model = Real-ESRGAN
4. [ ] **Slice 10:** Auf Quality wechseln, "4x Upscale" klicken -- `onUpscale({ scale: 4, tier: "quality" })`, Model = Crystal-Upscaler

### Flow 5: Canvas Chat

1. [ ] **Slice 11:** Chat-Panel oeffnen -- TierToggle ueber Chat-Input sichtbar (Draft Default)
2. [ ] **Slice 11:** Auf "Quality" wechseln -- MaxQualityToggle erscheint
3. [ ] **Slice 11:** Nachricht senden -- AI streamt Antwort
4. [ ] **Slice 11:** Waehrend Streaming: TierToggle bleibt interaktiv
5. [ ] **Slice 11:** Generation getriggert -- `generateImages` mit img2img/quality Model (event.model_id ignoriert)
6. [ ] **Slice 11:** MaxQuality aktivieren, Generation triggern -- img2img/max Model verwendet

---

## Edge Cases

### Error Handling

- [ ] **Slice 04:** Replicate Collection nicht ladbar -- Fehlermeldung "Could not load models" in Dropdown
- [ ] **Slice 04:** Inkompatibles Model auswaehlen -- Model ausgegraut, nicht selektierbar
- [ ] **Slice 03:** `updateModelSetting` mit ungueltigem modelId-Format -- `{ error: "Invalid model ID format" }`
- [ ] **Slice 03:** `updateModelSetting` mit `(upscale, max)` -- `{ error: "Upscale mode does not support max tier" }`
- [ ] **Slice 03:** `updateModelSetting` mit inkompatiblem img2img-Model -- `{ error: "Model does not support this mode" }`
- [ ] **Slice 07:** Generation ohne geladene Settings -- verhindert (Button disabled oder Frueh-Return)
- [ ] **Slice 08:** Canvas Settings-Fetch fehlgeschlagen -- Fallback auf `currentGeneration.modelId`

### State Transitions

- [ ] `draft-selected` -> Click "Quality" -> `quality-selected` (TierToggle animiert, MaxQualityToggle erscheint)
- [ ] `quality-selected` -> Click "Draft" -> `draft-selected` (MaxQualityToggle verschwindet)
- [ ] `quality-selected` -> Click "Max Quality" -> `quality-max-selected` (Toggle aktiviert)
- [ ] `quality-max-selected` -> Click "Max Quality" -> `quality-selected` (Toggle deaktiviert)
- [ ] `quality-max-selected` -> Click "Draft" -> `draft-selected` (MaxQualityToggle verschwindet)
- [ ] any -> Click Settings-Icon -> `settings-open` (Modal oeffnet)
- [ ] `settings-open` -> Close -> previous state (Model-Zuweisungen gespeichert)
- [ ] any tier -> Click Generate -> `generating` (Spinner, TierToggle disabled)
- [ ] `generating` -> Generation done -> previous tier state (TierToggle wieder enabled)
- [ ] quality/Chat -> Send Message -> `streaming` (TierToggle bleibt interaktiv)

### Boundary Conditions

- [ ] **Slice 06:** TierToggle disabled waehrend Generation (isGenerating === true)
- [ ] **Slice 11:** TierToggle interaktiv waehrend Streaming (isStreaming === true)
- [ ] **Slice 11:** TierToggle disabled waehrend Generation aus Chat (isGenerating === true)
- [ ] **Slice 06:** Upscale-Mode: kein MaxQualityToggle sichtbar selbst bei Quality
- [ ] **Slice 10:** Popover geschlossen/erneut geoeffnet: Tier zurueck auf Draft (nicht persistiert)
- [ ] **Slice 01:** Migration idempotent: erneutes Ausfuehren keine Duplikate (ON CONFLICT DO NOTHING)
- [ ] **Slice 02:** `seedModelSettingsDefaults()` idempotent: zweiter Aufruf keine Duplikate
- [ ] **Slice 09:** Variation und Img2Img Popovers haben unabhaengige Tier-States

---

## Cross-Slice Integration Points

| # | Integration Point | Slices | How to Verify |
|---|-------------------|--------|---------------|
| 1 | DB Schema -> Queries -> Service | 01 -> 02 | Unit-Test: Service kann CRUD auf model_settings Tabelle ausfuehren |
| 2 | Service -> Server Actions | 02 -> 03 | Unit-Test: getModelSettings/updateModelSetting delegieren korrekt an Service |
| 3 | Server Actions -> Settings Dialog | 03 -> 04 | Manuell: Dialog oeffnen, Model aendern, schliessen, erneut oeffnen, Persistenz pruefen |
| 4 | Types -> TierToggle Component | 03 -> 05 | TypeScript-Check: TierToggle Props nutzen Tier Type korrekt |
| 5 | TierToggle -> Workspace Prompt-Area | 05 -> 06 | Manuell: TierToggle sichtbar, klickbar, MaxQualityToggle bei Quality |
| 6 | Prompt-Area State -> Generation Logic | 06 -> 07 | Manuell: Draft/Quality/Max generieren, korrektes Model-ID in DB pruefen |
| 7 | Generation Service Upscale -> Canvas Upscale | 07 -> 10 | Manuell: Canvas Upscale mit Draft/Quality, korrektes Model |
| 8 | Canvas Context -> Tool Handlers | 08 -> 09/10/11 | Manuell: modelSettings in Canvas geladen, Handler resolven korrekt |
| 9 | Popover Tier -> Handler Model-Resolution | 09 -> canvas-detail-view | Manuell: Variation Quality generieren, Model aus img2img/quality Settings |
| 10 | Chat Tier -> Generation Override | 11 -> generateImages | Manuell: Chat Quality generieren, event.model_id ignoriert, Settings-Model verwendet |
| 11 | Canvas Cleanup -> Dead Code | 12 -> 13 | `pnpm tsc --noEmit` + `pnpm lint` + `pnpm build` fehlerfrei |

---

## Sign-Off

| Tester | Date | Result |
|--------|------|--------|
| | | |

**Notes:**
- All 13 slices have passed Gate 2 compliance
- 0 integration gaps identified
- 100% discovery coverage
