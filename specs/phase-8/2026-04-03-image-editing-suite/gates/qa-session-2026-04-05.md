## QA Session Summary

**Datum:** 2026-04-05
**Scope:** AI Image Editing Suite — Alle 5 Edit-Modi + Keyboard Shortcuts + Navigation Lock
**Test-Modus:** Hybrid (Agent autonom via Chrome DevTools + User-Feedback)
**Dokumente:**
- Discovery: `specs/phase-8/2026-04-03-image-editing-suite/discovery.md`
- Plan: `specs/phase-8/2026-04-03-image-editing-suite/slices/slim-slices.md`

### Status-Matrix

| Feature | Getestet von | Status |
|---------|-------------|--------|
| Inpaint (Maske + Prompt) | Agent | ✅ Funktional (Flux Fill Pro) |
| Erase (Maske + Entfernen) | Agent | ✅ Gefixt — nutzt jetzt `bria/eraser` Fallback |
| Instruction Edit (Chat ohne Maske) | Agent | ✅ Gefixt — nutzt jetzt `flux-kontext-pro` Fallback |
| Click-to-Edit / SAM | Agent | ✅ Gefixt — Version-Hash + Output-Parsing |
| Erase-to-Inpaint Upgrade | Agent | ✅ Chat + Maske in Erase-Mode → Inpaint korrekt |
| Outpaint (Bild erweitern) | Agent | ✅ UI perfekt (4 Richtungen, Size-Selector) |
| Keyboard Shortcuts | Agent | ✅ `]`/`[`/`E` alle funktional |
| Navigation Lock | Agent | ✅ Next disabled, Tool-Wechsel korrekt |

### Gefundene & Behobene Bugs (diese Session)

1. **SAM 404 — Falscher API-Aufruf** (Hoch) — ✅ Behoben
   - Datei: `app/api/sam/segment/route.ts:25`
   - Problem: `meta/sam-2` model-based prediction endpoint gibt 404 zurueck
   - Fix: Version-Hash hinzugefuegt (`meta/sam-2:fe97b453...`) fuer version-based endpoint
   - Zusaetzlich: Output-Parsing gefixt — SAM 2 gibt `{combined_mask, individual_masks}` Object zurueck, nicht Array

2. **Erase ruft falsche Modelle auf** (Hoch) — ✅ Behoben
   - Datei: `components/canvas/canvas-detail-view.tsx:303`
   - Problem: Fallback nutzt `currentGeneration.modelId` (z.B. `hunyuan-image-3`) statt Erase-Modell
   - Fix: `ERASE_FALLBACK_MODEL = "bria/eraser"` als Fallback

3. **Chat Edit ohne Maske ruft falsches Modell** (Hoch) — ✅ Behoben
   - Datei: `components/canvas/canvas-chat-panel.tsx:364,512`
   - Problem: Instruction-Fallback nutzt `generation.modelId` (z.B. `flux-fill-pro`) statt Instruction-Modell
   - Fix: `INSTRUCTION_FALLBACK_MODEL = "black-forest-labs/flux-kontext-pro"` an 2 Stellen

### Fruehere Bugs (73d772c)

4. **~~Mask Canvas synchronisiert sich nicht beim Mount~~** — ✅ Behoben (73d772c)
5. **~~mask_url wird nicht an Canvas Agent gesendet~~** — ✅ Behoben (73d772c)

### Adversarial Tests (Runde 1)

| Test | Ergebnis |
|------|----------|
| SAM Ecken-Klick (5% von top-left) | ✅ Maske korrekt gesetzt |
| SAM nach Moduswechsel Erase→Click Edit | ✅ Funktional |
| Erase-to-Inpaint Upgrade (Chat + Maske) | ✅ Korrekt zu Flux Fill Pro geroutet |
| Chat Edit ohne Maske auf Flux-Fill-Pro-Bild | ✅ Korrekt zu Flux Kontext Pro geroutet |
| Schneller Moduswechsel Click Edit→Erase→Click Edit | ✅ Stabil |
| Console Errors nach allen Tests | ✅ Keine Errors |

### Zusammenfassung

- ✅ 8 Features bestanden
- ✅ 3 neue Bugs gefixt (SAM, Erase-Fallback, Instruction-Fallback)
- ✅ TypeScript kompiliert clean
- ✅ Keine Console Errors
- ✅ Adversarial Tests bestanden

### Naechste Schritte

- [x] SAM Version-Hash + Output-Parsing (`app/api/sam/segment/route.ts`)
- [x] Erase Fallback Model (`components/canvas/canvas-detail-view.tsx`)
- [x] Instruction Fallback Model (`components/canvas/canvas-chat-panel.tsx`)
- [x] Browser Re-Test aller 3 Fixes via Chrome DevTools
- [x] Adversarial Edge-Case Tests
- [ ] Tests aktualisieren (SAM Output-Parsing Tests)
