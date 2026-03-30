# Slice 13: Chat Panel -- TierToggle durch ModelSlots (compact) ersetzen

> **Slice 13 von 16** fuer `Model Slots`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-13-chat-panel` |
| **Test** | `pnpm test components/canvas/canvas-chat-panel` |
| **E2E** | `false` |
| **Dependencies** | `["slice-07-model-slots-ui-compact"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/canvas/canvas-chat-panel` |
| **Integration Command** | `pnpm tsc --noEmit` |
| **Acceptance Command** | N/A |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | N/A |
| **Mocking Strategy** | `mock_external` (Server Actions, ModelSlots-Komponente via Vitest mocks) |

---

## Ziel

`canvas-chat-panel.tsx` von Tier-basierter Model-Resolution auf Slot-basierte Resolution umstellen. TierToggle wird durch `ModelSlots` (compact) ersetzt. Props migrieren von `modelSettings` auf `modelSlots` + `models`. Die Slots bleiben waehrend AI-Streaming interaktiv.

---

## Acceptance Criteria

1) GIVEN das Chat Panel wird gerendert
   WHEN die Props inspiziert werden
   THEN akzeptiert `CanvasChatPanelProps` die Props `modelSlots: ModelSlot[]` und `models: Model[]`
   AND `modelSettings?: ModelSetting[]` ist entfernt
   AND der `Tier` Type-Import ist entfernt

2) GIVEN das Chat Panel ist expanded (nicht collapsed)
   WHEN der Bereich zwischen ChatThread und ChatInput gerendert wird
   THEN wird `<ModelSlots variant="compact" ... />` angezeigt (NICHT `<TierToggle>`)
   AND das Element mit `data-testid="chat-tier-bar"` ist durch ein aequivalentes Test-ID fuer die Slot-Leiste ersetzt

3) GIVEN das Chat Panel rendert ModelSlots (compact)
   WHEN die Komponente sichtbar ist
   THEN werden die Slots fuer den Mode `"img2img"` angezeigt (Chat-Panel nutzt img2img fuer Generierungen)
   AND die uebergebenen `models` werden mode-gefiltert an ModelSlots weitergereicht
   AND KEIN ParameterPanel ist sichtbar (compact-Eigenschaft)

4) GIVEN 2 Slots sind aktiv (Slot 1: "flux-schnell", Slot 2: "flux-pro")
   WHEN ein `canvas-generate` SSE-Event mit `action: "img2img"` eintrifft
   THEN wird `generateImages` mit `modelIds` aufgerufen die aus den aktiven Slots aufgeloest werden (NICHT aus `modelSettings.find(s => s.tier === tier)`)
   AND die `modelParams` des ersten aktiven Slots werden als Basis-Params genutzt

5) GIVEN das Chat Panel sendet eine Nachricht an den Backend-Service
   WHEN der `imageContext` aufgebaut wird
   THEN enthaelt der Kontext `active_model_ids: string[]` (aktive Slot-Model-IDs) statt `selected_tier: Tier`
   AND `tier_models` (Record aus Tier-Keys) ist entfernt/ersetzt durch die Slot-basierte Struktur

6) GIVEN der AI-Stream laeuft (isStreaming === true)
   WHEN der User einen Slot-Checkbox toggled oder ein Model im Dropdown wechselt
   THEN bleibt die ModelSlots-Komponente interaktiv (NICHT disabled)
   AND nur waehrend `state.isGenerating === true` (Bild-Generierung) werden die Slots disabled

7) GIVEN die `buildImageContext` Helper-Funktion
   WHEN sie mit `modelSlots` statt `modelSettings` aufgerufen wird
   THEN baut sie den Kontext aus aktiven Slots auf (`modelSlots.filter(s => s.mode === "img2img" && s.active)`)
   AND die Signatur aendert sich von `(generation, modelSettings)` auf `(generation, modelSlots)`

8) GIVEN der Import-Block von `canvas-chat-panel.tsx`
   WHEN Slice 13 implementiert ist
   THEN ist `TierToggle` Import entfernt
   AND `ModelSlots` aus `@/components/ui/model-slots` importiert
   AND `ModelSlot` Type aus `@/lib/db/queries` importiert (statt `ModelSetting`)
   AND `Tier` Type Import ist entfernt

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/canvas/__tests__/canvas-chat-panel-slots.test.tsx`

<test_spec>
```typescript
// AC-1: Props akzeptieren modelSlots + models statt modelSettings
it.todo('should accept modelSlots and models props and not accept modelSettings')

// AC-2: ModelSlots compact wird statt TierToggle gerendert
it.todo('should render ModelSlots with variant compact instead of TierToggle between ChatThread and ChatInput')

// AC-3: ModelSlots zeigt img2img-Mode Slots ohne ParameterPanel
it.todo('should pass mode img2img and models to ModelSlots compact without ParameterPanel')

// AC-4: canvas-generate nutzt aktive Slots statt tier-basiertem Lookup
it.todo('should resolve modelIds from active slots when handling canvas-generate event')

// AC-5: imageContext enthaelt active_model_ids statt selected_tier
it.todo('should build image context with active model IDs instead of selected_tier')

// AC-6: Slots bleiben interaktiv waehrend Streaming
it.todo('should keep ModelSlots interactive during AI streaming and only disable during image generation')

// AC-7: buildImageContext nutzt modelSlots statt modelSettings
it.todo('should build image context from active img2img model slots')

// AC-8: Imports nutzen model-slots statt tier-toggle und model-settings
it.todo('should import ModelSlots and ModelSlot type instead of TierToggle and ModelSetting')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-07` | `ModelSlots` (compact-faehig) | React Component | `<ModelSlots variant="compact" ... />` rendert horizontal |
| `slice-05` | `updateModelSlot()` | Server Action | Von ModelSlots intern aufgerufen |
| `slice-05` | `toggleSlotActive()` | Server Action | Von ModelSlots intern aufgerufen |
| `slice-02` | `ModelSlot` | Inferred DB Type | Import kompiliert |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `CanvasChatPanel` (migrated) | React Component | `canvas-detail-view.tsx` | Props: `modelSlots: ModelSlot[], models: Model[]` statt `modelSettings` |

**Known Dependency:** `canvas-detail-view.tsx` (Slice 12) uebergibt aktuell `modelSettings` an ChatPanel (AC-9 Rueckwaertskompatibilitaet). Nach Slice 13 muss Slice 12 aktualisiert werden: `modelSettings`-Mapping entfernen, stattdessen `modelSlots` + `models` direkt uebergeben. Der `Tier`-Import in canvas-detail-view.tsx kann dann ebenfalls entfernt werden.

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/canvas-chat-panel.tsx` -- MODIFY: Props von `modelSettings` auf `modelSlots` + `models` migrieren; TierToggle durch `<ModelSlots variant="compact">` ersetzen; `tier` State und `Tier`-Import entfernen; `handleCanvasGenerate` auf aktive-Slot-Resolution umstellen; `buildImageContext` auf Slot-basierte Struktur umstellen; Streaming-Interaktivitaet der Slots sicherstellen.
- [ ] `components/canvas/canvas-detail-view.tsx` -- MODIFY: ChatPanel-Aufruf von `modelSettings={modelSettings}` auf `modelSlots={modelSlots} models={models}` umstellen; `Tier`-Import entfernen (wird nicht mehr fuer ChatPanel-Mapping benoetigt); gemapptes `modelSettings`-Objekt (AC-9 aus Slice 12) entfernen.
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an `ModelSlots`-Komponente selbst (bereits in Slice 06/07 fertig)
- KEINE Aenderungen an Server Actions, DB-Schema, Types oder Queries
- KEINE Aenderungen an ChatThread, ChatInput, ModelSelector, canvas-chat-service
- KEINE Aenderungen an Popover-Komponenten oder prompt-area.tsx
- KEIN ParameterPanel im Chat Panel (compact Layout zeigt keine Parameter per Discovery-Ausnahme)
- KEINE neuen Server Actions oder API-Aenderungen

**Technische Constraints:**
- `ModelSlots` erhaelt `variant="compact"`, `mode="img2img"`, `slots={modelSlots}`, `models={models}`
- `disabled` Prop an ModelSlots: `disabled={state.isGenerating}` (NICHT `isStreaming` -- Slots bleiben waehrend Streaming interaktiv)
- Model-Resolution in `handleCanvasGenerate`: `resolveActiveSlots(modelSlots, "img2img")` oder direktes Filtern nach aktiven img2img Slots
- Fallback wenn keine aktiven Slots: `generation.modelId` als Fallback beibehalten (bestehendes Verhalten)
- `buildImageContext` Signatur aendern: `modelSlots: ModelSlot[]` statt `modelSettings: ModelSetting[]`
- Event-Dispatch bei Slot-Aenderung: `"model-slots-changed"` -- wird von ModelSlots intern gehandelt, ChatPanel muss keinen eigenen Listener registrieren

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/canvas/canvas-chat-panel.tsx` | Modify: Hauptdeliverable -- TierToggle entfernen, ModelSlots einbauen |
| `components/canvas/canvas-detail-view.tsx` | Modify: ChatPanel-Props aktualisieren (Mount-Point-Check) |
| `components/ui/model-slots.tsx` | Import: `ModelSlots` Komponente, unveraendert |
| `lib/utils/resolve-model.ts` | Import: `resolveActiveSlots()`, unveraendert |

**Referenzen:**
- Wireframes: `specs/phase-7/2026-03-29-model-slots/wireframes.md` -> Section "Canvas Chat Panel" (Compact Layout, Annotation 1, State Variations)
- Discovery: `specs/phase-7/2026-03-29-model-slots/discovery.md` -> Section 3 "Regeln" (Compact = horizontale Einzeiler ohne Parameter; Chat Panel: Default-Parameter)
- Discovery: `specs/phase-7/2026-03-29-model-slots/discovery.md` -> Section 6 "Slot-States" (Streaming: Slots bleiben interaktiv)
- Architecture: `specs/phase-7/2026-03-29-model-slots/architecture.md` -> Section "Migration Map" -> `canvas-chat-panel.tsx` Zeile
