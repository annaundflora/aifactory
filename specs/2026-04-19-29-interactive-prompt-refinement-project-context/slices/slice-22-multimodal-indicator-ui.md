# Slice 22: Multimodal-Indicator UI

> **Slice 22 von 28** für `Interactive Prompt Refinement in Assistant with Per-Project Context`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-22-multimodal-indicator-ui` |
| **Test** | `pnpm test components/assistant/__tests__/multimodal-indicator.test.tsx` |
| **E2E** | `true` |
| **Dependencies** | `["21-multimodal-pipeline-budget", "18-result-image-multimodal"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` (React Component + Playwright E2E) |
| **Test Command** | `pnpm test components/assistant/__tests__/multimodal-indicator.test.tsx` |
| **Integration Command** | `pnpm test components/assistant/` |
| **Acceptance Command** | `pnpm exec playwright test e2e/assistant/multimodal-indicator.spec.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000/api/health` |
| **Mocking Strategy** | `mock_external` (`WorkspaceStateProvider` + `PromptAssistantContext` werden in Tests via Provider-Wrapper injiziert; kein Netzwerk) |

---

## Ziel

Eine schlanke Indicator-Komponente unter dem ChatInput rendert genau, was der Assistant aktuell „sieht" (Refs + letztes Ergebnis), damit Nutzer Multimodal-State transparent nachvollziehen können. Die Komponente versteckt sich, wenn nichts Multimodales angehängt ist, und zeigt „Sieht: nur Text" bei Non-Vision-Modellen, deren Bilder im Backend gestrippt werden.

---

## Acceptance Criteria

1) **Indicator zeigt korrekte Ref-Anzahl bei img2img + aktive Slots**
   GIVEN `generationMode === "img2img"` und der reaktive Slot-Store enthält 2 Slots mit gültigem `imageUrl`, AND `state.lastResultImageUrl === null`, AND aktives Chat-Modell ist Vision-fähig
   WHEN der Indicator gemountet ist
   THEN rendert er den Text `"Sieht: 2 Refs"` als sichtbares Element

2) **Indicator zeigt Refs + letztes Ergebnis kombiniert**
   GIVEN `generationMode === "img2img"` und 2 aktive Refs im reaktiven Slot-Store, AND `state.lastResultImageUrl` ist ein gültiger HttpUrl-String, AND aktives Chat-Modell ist Vision-fähig
   WHEN der Indicator gemountet ist
   THEN rendert er exakt den Text `"Sieht: 2 Refs + letztes Ergebnis"`

3) **Indicator zeigt nur „letztes Ergebnis" ohne Refs**
   GIVEN `state.lastResultImageUrl` ist gesetzt, AND der reaktive Slot-Store ist leer (oder `generationMode === "txt2img"`)
   WHEN der Indicator gemountet ist
   THEN rendert er den Text `"Sieht: letztes Ergebnis"` (keine Ref-Anzahl)

4) **Indicator versteckt sich bei txt2img ohne letztes Ergebnis**
   GIVEN `generationMode === "txt2img"` und `state.lastResultImageUrl === null` (Refs werden im txt2img-Modus ignoriert, siehe Slice 19 Modus-Gate)
   WHEN der Indicator gemountet ist
   THEN rendert die Komponente NICHTS Sichtbares (kein DOM-Output bzw. `display: none`-Wrapper)

5) **Indicator zeigt „Sieht: nur Text" bei Non-Vision-Modell**
   GIVEN das aktive Chat-Modell ist als Non-Vision markiert (Frontend-Mirror der Vision-Capability), AND mindestens ein Multimodal-Eintrag wäre attached (Refs ODER `state.lastResultImageUrl`)
   WHEN der Indicator gemountet ist
   THEN rendert er exakt `"Sieht: nur Text"` und nicht die Ref-/Result-Variante

6) **Singular-Form bei genau 1 Ref**
   GIVEN `generationMode === "img2img"` und genau 1 aktiver Slot im reaktiven Slot-Store, AND `state.lastResultImageUrl === null`
   WHEN der Indicator gemountet ist
   THEN rendert er `"Sieht: 1 Ref"` (Singular, keine `1 Refs`-Form)

7) **Indicator wird unter ChatInput gemountet**
   GIVEN `<AssistantPanelContent>` ist gerendert
   WHEN das Panel-DOM inspiziert wird
   THEN folgt `<MultimodalIndicator>` direkt nach dem `<ChatInput>` im DOM (vgl. wireframes.md → Section "Multimodal-Indicator", Annotation ④)

8) **Reaktive Aktualisierung bei Slot-Änderung**
   GIVEN Indicator zeigt initial `"Sieht: 1 Ref"` (1 Slot im reaktiven Slot-Store)
   WHEN ein zweiter Slot via `setReferenceSlots(...)` des `WorkspaceStateProvider` hinzugefügt wird
   THEN aktualisiert der Indicator ohne Reload auf `"Sieht: 2 Refs"` (Re-Render durch Provider-State-Change)

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC. Test-Setup nutzt React Testing Library + `WorkspaceStateProvider` + `PromptAssistantProvider` als Test-Wrapper.

### Test-Datei: `components/assistant/__tests__/multimodal-indicator.test.tsx`

<test_spec>
```typescript
// AC-1: Indicator zeigt korrekte Ref-Anzahl bei img2img + aktive Slots
it.todo('AC-1: renders "Sieht: 2 Refs" with 2 active slots in img2img + vision model + no last result')

// AC-2: Indicator zeigt Refs + letztes Ergebnis kombiniert
it.todo('AC-2: renders "Sieht: 2 Refs + letztes Ergebnis" with 2 slots and last result url set')

// AC-3: Indicator zeigt nur "letztes Ergebnis" ohne Refs
it.todo('AC-3: renders "Sieht: letztes Ergebnis" when only state.lastResultImageUrl is set')

// AC-4: Indicator versteckt sich bei txt2img ohne letztes Ergebnis
it.todo('AC-4: renders nothing visible in txt2img with no last result')

// AC-5: Indicator zeigt "Sieht: nur Text" bei Non-Vision-Modell
it.todo('AC-5: renders "Sieht: nur Text" when active chat model is non-vision and attachments exist')

// AC-6: Singular-Form bei genau 1 Ref
it.todo('AC-6: renders "Sieht: 1 Ref" (singular) for exactly 1 active slot')

// AC-8: Reaktive Aktualisierung bei Slot-Änderung
it.todo('AC-8: re-renders from "Sieht: 1 Ref" to "Sieht: 2 Refs" when WorkspaceStateProvider slot store updates')
```
</test_spec>

### Test-Datei: `e2e/assistant/multimodal-indicator.spec.ts`

<test_spec>
```typescript
// AC-2: 2 Refs + Result attached → Indicator zeigt vollen Text
test.todo('AC-2 (E2E): img2img with 2 reference slots + 1 generated result → indicator shows "Sieht: 2 Refs + letztes Ergebnis"')

// AC-4: txt2img ohne Anhang → Indicator versteckt
test.todo('AC-4 (E2E): txt2img without attachments → multimodal indicator is not visible in panel')

// AC-7: Indicator wird unter ChatInput gemountet
test.todo('AC-7 (E2E): indicator DOM node is rendered as immediate sibling after chat-input region')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-18-result-image-multimodal` | `state.lastResultImageUrl: string \| null` (Reducer-State) | Reducer-State | Indicator subscribed via `usePromptAssistant().state.lastResultImageUrl` (Reducer-State, daher Re-Render-Trigger). Wert ist HttpUrl-String oder `null`. Slice 18 listet diese Resource explizit unter "Provides To Other Slices" für `slice-22`. |
| `slice-19-reference-slots-dto` | `ReferenceSlotData`-Schema (Wire-Format / Type-Shape) | Type-Shape | NUR als DTO-Schema/Type-Shape verwendet — NICHT als reaktive Slot-Quelle. Slice 19 liefert nur `referenceSlotsRef` (`useRef<...>`, NICHT reaktiv) und keinen Reducer-State; daher ist die reaktive Slot-Quelle das in diesem Slice erweiterte `WorkspaceStateProvider` (siehe Deliverables). |
| `slice-21-multimodal-pipeline-budget` | Modus-Gate-Verhalten (Slots werden in txt2img ignoriert) | Verhalten | Indicator spiegelt das gleiche Gate auf UI-Seite |
| Existing | `WorkspaceStateProvider` aus `lib/workspace-state.tsx` | Context-Provider | Bereits reaktive Provider-Quelle; wird in diesem Slice um `referenceSlots` + `setReferenceSlots` (Hochheben aus `prompt-area.tsx:165`) erweitert |
| Existing | `generationMode` (lokaler State in `prompt-area.tsx:116`) | State-Wert | `"txt2img" \| "img2img"` — wird ebenfalls über das `WorkspaceStateProvider`-Update reaktiv exponiert (siehe Deliverables) |
| Existing | `usePromptAssistant()` (`lib/assistant/assistant-context.tsx:626`) | Hook | NICHT `useAssistantContext` — `usePromptAssistant` exposed `state`, `dispatch`, `selectedModel`, `selectedModelRef`; Indicator nutzt `state.lastResultImageUrl` + `selectedModel` für Vision-Capability-Lookup |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `<MultimodalIndicator />` | React Component (no props) | `assistant-panel.tsx` (Mount-Punkt direkt unter `<ChatInput>`) | `() => JSX.Element \| null` |
| `WorkspaceStateProvider.referenceSlots` (added) | Reactive Provider-State | `prompt-area.tsx` (state lifting) + `multimodal-indicator.tsx` (subscriber) | `referenceSlots: ReferenceSlotData[]` + `setReferenceSlots: (next: ReferenceSlotData[]) => void` (oder Updater-Signatur analog zu existierendem `setVariation`) |
| `WorkspaceStateProvider.generationMode` (added) | Reactive Provider-State | `multimodal-indicator.tsx` (subscriber) | `generationMode: GenerationMode` + `setGenerationMode: (mode: GenerationMode) => void` |

> Die Komponente nimmt KEINE Props entgegen — alle Daten werden via `useWorkspaceVariation()` (für Slots + Mode) und `usePromptAssistant()` (für `state.lastResultImageUrl` + `selectedModel`) bezogen. Damit ist der Mount in `assistant-panel.tsx` ein einzeiliger Render-Add ohne Prop-Drilling.

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/workspace-state.tsx` (Edit) — `WorkspaceStateProvider` um reaktiven `referenceSlots: ReferenceSlotData[]` + `setReferenceSlots` erweitern UND um `generationMode: GenerationMode` + `setGenerationMode` erweitern; `useWorkspaceVariation()`-Return um diese Felder ergänzen (additive Änderung, keine Breaking-Changes für bestehende Consumer)
- [ ] `components/workspace/prompt-area.tsx` (Edit) — Lokalen `useState<ReferenceSlotData[]>` (Zeile 165) und `useState<GenerationMode>` (Zeile 116) in den Provider hochheben; `setReferenceSlots`/`setGenerationMode` aus `useWorkspaceVariation()` lesen statt lokal halten; Slot-Sync zu `referenceSlotsRef` (Slice 19) bleibt unverändert
- [ ] `components/assistant/multimodal-indicator.tsx` (NEW) — React-Komponente, die Slots/Mode aus `useWorkspaceVariation()` und `state.lastResultImageUrl`/`selectedModel` aus `usePromptAssistant()` subscribed und die Indicator-Zeile rendert (oder `null` zurückgibt)
- [ ] `components/assistant/assistant-panel.tsx` (Edit) — Import + Mount des `<MultimodalIndicator />` direkt nach `<ChatInput>` (Zeile ~166 in `AssistantPanelContent`)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Änderungen an `referenceSlotsRef` / `lastResultImageUrlRef` / Reducer-Logik (alles bereits durch Slices 18/19/21 bereitgestellt)
- KEIN neuer SSE-Event, keine neue Reducer-Action; Indicator ist reine View-Schicht
- KEIN eigener Modus-Toggle — `generationMode` wird nur ins `WorkspaceStateProvider` hochgehoben, NICHT semantisch verändert
- KEIN Detail-View / Tooltip / Hover-Card — nur reine Text-Zeile (Discovery: „dezenter Hinweis")
- KEINE i18n-Pluralrules-Lib; Singular/Plural-Branch wird einfach inline gewählt (1 Ref vs. N Refs)
- KEINE Änderungen an existierenden `useWorkspaceVariation()`-Consumern (`assistant-panel.tsx:56`, andere) außer additive Felder

**Technische Constraints:**
- Komponente ist Client-Component (`"use client"`), da sie auf React-Context subscribed
- Reaktivität: Slot-State + Mode laufen über `WorkspaceStateProvider` (React-Context, daher Re-Render-Trigger). `state.lastResultImageUrl` läuft über `usePromptAssistant()`-Reducer (ebenfalls Re-Render-Trigger). KEIN Direkt-Lesen von `*.current` ohne Re-Render-Trigger (sonst stale UI), KEIN `useAssistantContext`
- State-Lifting in `prompt-area.tsx`: bestehendes Verhalten (mode-states-Persistence-Matrix, Snapshot-zu-`referenceSlotsRef`-Sync) bleibt funktional unverändert; nur die Quelle des `useState`-Werts wechselt vom lokalen Hook zum Provider
- Frontend-Vision-Mirror: Liste der Non-Vision-Chat-Models lebt in einer kleinen Konstante in `multimodal-indicator.tsx` und mirrored die Backend-`vision`-Flags aus `chat_llm_limits.py`. Da der aktuelle 3-Modell-Allowlist (Slice 20 Architecture-Tabelle) ALLE `vision: True` hat, wird der Non-Vision-Pfad defensiv für künftige Modell-Erweiterungen gerendert; Default = vision-fähig.
- Styling: Tailwind, dezent (kleine Schriftgröße, gedämpfte Farbe analog wireframes.md → Section „Multimodal-Indicator")
- Keine externen UI-Lib-Komponenten nötig; einfacher `<div>` reicht

**Referenzen:**
- Architecture: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/architecture.md` → Tabelle „Card subscription" Zeile „Multimodal indicator" + Tabelle „Frontend Components" Zeilen `multimodal-indicator.tsx` und `assistant-panel.tsx`
- Architecture: ADR „Reference-slot snapshot per turn" + Constraint „Non-vision LLM fallback"
- Wireframes: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/wireframes.md` → Section „Multimodal-Indicator" (Annotationen ④, plus State-Variations `txt2img_no_refs` und `non_vision_model`)
- Discovery: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/discovery.md` → Slice I „ReferenceBar → Multimodal-Pipeline" (UI-Layer)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/workspace-state.tsx` | Edit, NICHT neu erstellen — additive Provider-Felder (`referenceSlots`, `setReferenceSlots`, `generationMode`, `setGenerationMode`); bestehende `variationData`/`setVariation`/`clearVariation`-API bleibt unverändert (keine Breaking-Changes für Lightbox/Workspace-Variation-Consumer) |
| `components/workspace/prompt-area.tsx` | Edit — lokalen `useState` für `referenceSlots` (Zeile 165) und `currentMode` (Zeile 116) durch Provider-State ersetzen; bestehende Per-Mode-State-Persistence-Matrix und Sync zu `referenceSlotsRef`/`generationModeRef` (Slice 19) bleibt unverändert |
| `components/assistant/assistant-panel.tsx` | Edit, NICHT neu erstellen — nur ein zusätzlicher Render-Slot direkt unter `<ChatInput>` (Zeile ~166 in `AssistantPanelContent.renderContent`); existierender `useWorkspaceVariation()`-Aufruf (Zeile 56) bleibt unverändert |
| `lib/assistant/use-assistant-runtime.ts` | Lesen — `selectedModelRef` für Vision-Lookup; KEINE Mutation; `referenceSlotsRef` wird vom Indicator NICHT direkt gelesen (nur Slice-19-Sender nutzt es) |
| `lib/assistant/assistant-context.tsx` | Subscription via `usePromptAssistant()`-Hook (Zeile 626) auf `state.lastResultImageUrl` (aus Slice 18) und `selectedModel` — KEINE neuen Actions/Felder, KEIN `useAssistantContext` |
| `lib/types/reference.ts` (`ReferenceSlotData`) | Type-Import für Provider-State-Signatur; KEINE Mutation |
