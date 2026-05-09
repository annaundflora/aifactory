# Slice 18: Result-Image als Multimodal-Input

> **Slice 18 von 28** für `Interactive Prompt Refinement in Assistant with Per-Project Context`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-18-result-image-multimodal` |
| **Test** | `pnpm test lib/assistant/__tests__/use-assistant-runtime lib/assistant/__tests__/assistant-context components/assistant/__tests__/chat-thread` |
| **E2E** | `true` |
| **Dependencies** | `["17-auto-apply-generate-handler"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/assistant/__tests__/use-assistant-runtime lib/assistant/__tests__/assistant-context components/assistant/__tests__/chat-thread` |
| **Integration Command** | `pnpm test lib/assistant components/assistant` |
| **Acceptance Command** | `pnpm test:e2e tests/e2e/result-image-multimodal.spec.ts` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000/api/health` |
| **Mocking Strategy** | `mock_external` (`generateImages()` Server-Action gemockt; SSE-Stream-Stub für E2E; `CanvasDetailView`-Open-Verhalten gegen Stub testbar) |

---

## Ziel

Schliesst den Refinement-Loop: nach erfolgreichem Generate hält das Frontend die letzte Result-URL pro Session, sendet sie beim nächsten Assistant-Turn als `last_result_image_url` mit, und rendert assistant-seitig eine `result_message`-Variante mit Inline-Thumbnail. Klick auf das Thumbnail öffnet die bestehende Detail-View.

---

## Acceptance Criteria

1) GIVEN eine Generierung im aktiven Projekt erreicht `status === "succeeded"` und liefert mindestens eine `imageUrl`
   WHEN der entsprechende State-Übergang von Slice 17 (`flowState === "generating"`) das Settle des Promise sieht
   THEN dispatcht der Auto-Apply-Handler **genau einmal** `{ type: "SET_LAST_RESULT_IMAGE_URL", url: <imageUrl-der-jüngsten-succeeded-Generation> }` UND der Reducer setzt `state.lastResultImageUrl` auf diesen Wert (alle anderen State-Felder unverändert).

2) GIVEN `state.lastResultImageUrl` ist gesetzt UND `usePromptAssistant().sendMessage(...)` wird aufgerufen
   WHEN `use-assistant-runtime.ts` den `POST /api/assistant/sessions/{id}/messages`-Body baut (Body-Aufbau wie architecture.md → "Migration Map" Zeile `lib/assistant/use-assistant-runtime.ts:354-373`)
   THEN enthält der Body genau das Feld `last_result_image_url: string` mit dem aktuellen Ref-Wert; bei `state.lastResultImageUrl === null` wird das Feld entweder weggelassen oder explizit `null` gesendet (Implementer wählt 1 Pattern, gemäss bestehender DTO-Optionalität in `backend/app/models/dtos.py:21-59`).

3) GIVEN Reducer empfängt `{ type: "SET_LAST_RESULT_IMAGE_URL", url: "https://example.com/img.png" }`
   WHEN Reducer-Pass erfolgt
   THEN `state.lastResultImageUrl === "https://example.com/img.png"`; bestehende Felder (`messages`, `flowState`, `intentSummaryPayload`, `draftPrompt`, …) bleiben unverändert; Initialwert von `lastResultImageUrl` im Reducer-Initial-State ist `null`.

4) GIVEN Reducer empfängt `{ type: "SET_LAST_RESULT_IMAGE_URL", url: null }`
   WHEN Reducer-Pass erfolgt
   THEN `state.lastResultImageUrl === null` (explicit-clear-Pfad für Session-Reset oder Project-Switch).

5) GIVEN ein Assistant-Message wird im Chat-Thread gerendert UND diese Message besitzt ein `resultImageUrl`-Attribut (Felderweiterung der `ChatMessage`-Type ODER äquivalentes Per-Message-Marker, Implementer entscheidet — siehe Constraints)
   WHEN `chat-thread.tsx` über die Messages iteriert
   THEN wird statt der Default-Assistant-Bubble die `result_message`-Variante gerendert: Layout = Thumbnail (links, ~120px square, rounded) + Assistant-Text (rechts, multiline) gemäss wireframes.md → "Screen: Reviewing Turn" → Annotation ①. Das Thumbnail trägt `data-testid="result_message.thumbnail"` und besitzt `role="button"` + Tastatur-Aktivierung (Enter/Space).

6) GIVEN AC-5 ist erfüllt UND der User klickt auf das Thumbnail (`data-testid="result_message.thumbnail"`)
   WHEN der Click-Handler ausgeführt wird
   THEN öffnet sich die bestehende Detail-View (`components/canvas/canvas-detail-view.tsx` via existierendes Mounting in `components/workspace/workspace-content.tsx:328`) für genau diese Generation; KEIN neues Modal wird gebaut (Reuse-Pflicht).

7) GIVEN ein Assistant-Message ohne `resultImageUrl`
   WHEN gerendert
   THEN bleibt das bestehende Bubble-Rendering aus Slice 16/17 unverändert (kein Layout-Shift, kein leerer Thumbnail-Slot).

8) GIVEN E2E: User durchläuft Slice 17 happy-path bis Generate succeeded
   WHEN das Backend den nächsten Assistant-Turn streamt (proaktiv-Starter via Base-Prompt-Regel — Verhalten kommt aus Slice 12)
   THEN zeigt der nächste Assistant-Message-Bubble das Thumbnail des gerade generierten Bildes UND einen Kommentar-Text mit Bezug zum Bild; Klick auf Thumbnail öffnet Detail-View (`data-testid="workspace-detail-view"` wird sichtbar — vorhanden ab `workspace-content.tsx:326`).

9) GIVEN E2E: `state.lastResultImageUrl` ist gesetzt
   WHEN User schickt eine neue Chat-Message ab (egal ob Refinement-Frage oder beliebiger Text)
   THEN enthält der Network-Request-Body das Feld `last_result_image_url` mit der korrekten URL (Playwright `page.waitForRequest` matcht den Body).

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Mock-Strategie: Reducer direkt via Test-Wrapper provisionieren; SSE-Stream gestubbed; `fetch` für POST-Body-Capture in `use-assistant-runtime.test.ts` gemockt; `CanvasDetailView` per Test-Stub aus bestehenden `workspace-content.test.tsx`-Patterns übernehmen.

### Test-Datei: `lib/assistant/__tests__/assistant-context.test.tsx` (Vitest) — erweitert

<test_spec>
```typescript
// AC-3: SET_LAST_RESULT_IMAGE_URL setzt URL, lässt andere Felder unverändert
it.todo('SET_LAST_RESULT_IMAGE_URL sets state.lastResultImageUrl to provided url and leaves other fields untouched');

// AC-4: explicit-clear-Pfad mit url: null
it.todo('SET_LAST_RESULT_IMAGE_URL with null clears state.lastResultImageUrl');

// AC-3: Initialwert ist null
it.todo('lastResultImageUrl initial reducer value is null');
```
</test_spec>

### Test-Datei: `lib/assistant/__tests__/use-assistant-runtime.test.ts` (Vitest) — erweitert

<test_spec>
```typescript
// AC-2: Body enthält last_result_image_url wenn Ref gesetzt
it.todo('sendMessage POST body includes last_result_image_url when lastResultImageUrl ref is set');

// AC-2: Feld weggelassen / null wenn Ref leer
it.todo('sendMessage POST body omits or nulls last_result_image_url when ref is null');

// AC-1: Auto-Apply-Handler dispatcht SET_LAST_RESULT_IMAGE_URL post-Generate-Success
it.todo('dispatches SET_LAST_RESULT_IMAGE_URL exactly once with imageUrl of newest succeeded generation');
```
</test_spec>

### Test-Datei: `components/assistant/__tests__/chat-thread.test.tsx` (Vitest + RTL) — erweitert

<test_spec>
```typescript
// AC-5: result_message-Variante rendert Thumbnail + Text
it.todo('renders result_message variant with thumbnail and text when message has resultImageUrl');

// AC-5: Thumbnail hat testid + ist tastatur-aktivierbar
it.todo('result_message thumbnail has data-testid="result_message.thumbnail" and role=button with keyboard activation');

// AC-6: Click auf Thumbnail öffnet Detail-View (gemockter Opener)
it.todo('clicking result_message thumbnail triggers existing detail-view opener with correct generationId');

// AC-7: Default-Bubble bei Message ohne resultImageUrl
it.todo('renders default assistant bubble when message has no resultImageUrl');
```
</test_spec>

### Test-Datei: `tests/e2e/result-image-multimodal.spec.ts` (Playwright)

<test_spec>
```typescript
// AC-8: E2E next-turn shows thumbnail + comment, click opens detail-view
test.skip('after successful generate, next assistant turn renders thumbnail + comment; click opens detail-view', async () => {
  // AC-8
});

// AC-9: E2E next sendMessage carries last_result_image_url in body
test.skip('next user message POST body contains last_result_image_url field', async () => {
  // AC-9
});
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-17-auto-apply-generate-handler` | Auto-Apply-Handler-Pfad mit Generate-Success-Settle (architecture.md → "Auto-Apply + Auto-Generate Trigger" → letzte Zeile `Backend generations.status flips to succeeded`) | Behavior | Settle-Hook muss neuen Dispatch akzeptieren |
| `slice-15-sse-flow-state-events` | Reducer-Action-Mechanismus + `usePromptAssistant()`-Hook-Pattern | Hook | unverändert nutzen |
| existing | `lib/assistant/use-assistant-runtime.ts:354-373` (Body-Builder mit Ref-Pattern an Zeilen 104-107) | Module | Ref-Pattern wird hier exakt repliziert für `lastResultImageUrlRef` |
| existing | `components/canvas/canvas-detail-view.tsx` (Detail-View) + Opener-Mechanismus in `components/workspace/workspace-content.tsx:326-336` | Component | unverändert — Reuse, kein neues Modal |
| existing | `usePromptAssistant()` (`lib/assistant/assistant-context.tsx:626`) | Hook | NICHT `useAssistantContext` — `usePromptAssistant` exposed `state`, `dispatch`, `sendMessage` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Reducer-Action `SET_LAST_RESULT_IMAGE_URL` | Reducer-Action | `slice-22-multimodal-indicator-ui` (subscribed an `lastResultImageUrlRef`/`state.lastResultImageUrl`), `slice-28-session-resume-flow-state` (Hydrate-Pfad) | `{ type: "SET_LAST_RESULT_IMAGE_URL", url: string \| null }` |
| `state.lastResultImageUrl: string \| null` | State-Field | `slice-22`, `slice-28` | Reducer-Selector |
| Body-Field `last_result_image_url` in `SendMessageRequest` (Frontend-Seite) | DTO-Field | `slice-19-reference-slots-dto` (Backend-DTO-Erweiterung), `slice-21-multimodal-pipeline-budget` (Backend-Konsum) | `string \| null \| undefined` (HTTP-JSON) |
| `result_message`-Variante in `chat-thread.tsx` | Render-Branch | --  | Render gated auf Per-Message-Marker (siehe Constraints) |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/assistant/use-assistant-runtime.ts` (Edit) — `lastResultImageUrlRef` analog zu existierenden Refs (Pattern Zeilen 104-107); Body-Aufbau (Zeilen 354-373) erweitert um `last_result_image_url`; Auto-Apply-Settle-Pfad dispatcht `SET_LAST_RESULT_IMAGE_URL` mit URL der jüngsten succeeded-Generation
- [ ] `lib/assistant/assistant-context.tsx` (Edit) — `lastResultImageUrl: string \| null` im `AssistantState` (Initial `null`); Reducer-Branch `SET_LAST_RESULT_IMAGE_URL` (Set + Clear); Action-Type-Union erweitert
- [ ] `components/assistant/chat-thread.tsx` (Edit) — `result_message`-Render-Branch: Thumbnail-Layout gemäss wireframes.md "Screen: Reviewing Turn" Annotation ①; `data-testid="result_message.thumbnail"`; `role=button` + Keyboard-Handler; Click delegiert an bestehenden Detail-View-Opener (Reuse von `workspace-content.tsx:326-336`-Pfad)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Backend-Code in diesem Slice — Backend-Konsum von `last_result_image_url` lebt in Slice 21 (Multimodal-Pipeline + Budget)
- KEINE Änderung am Base-Prompt — der "proaktiv-Starter"-Text kommt aus Slice 12 (Base-Prompt-Rewrite); Slice 18 setzt nur das Daten-Vehikel auf
- KEINE neue Detail-View, KEIN neues Modal — Klick auf Thumbnail nutzt bestehenden Opener
- KEINE Änderung an `SendMessageRequest`-Pydantic-DTO im Backend (das ist Slice 19); Frontend sendet Feld jetzt schon, Backend darf es transitorisch ignorieren bis Slice 19/21 grün
- KEINE Persistierung des `lastResultImageUrl` ins Backend / DB — pro Session in Reducer/Ref (architecture.md → "Out-of-DB persistence" Zeile `last_result_image_url`)
- KEINE Multi-History-Logik — nur **letztes** erfolgreiches Result wird gehalten (Discovery Slice H + business rule line 286)
- KEINE Multimodal-Indicator-UI — Slice 22
- KEINE Vision-Fallback-Logik im Frontend — Backend-Concern (Slice 21)

**Technische Constraints:**
- `lastResultImageUrlRef` mirroring-Pattern: Ref + Reducer-State synchron halten via `useEffect`, exakt wie für `generationModeRef`/andere Refs in `use-assistant-runtime.ts:104-107` praktiziert
- Per-Message-Marker für `result_message`-Variante: zwei akzeptable Implementierungs-Patterns — (a) `ChatMessage`-Type um `resultImageUrl?: string` erweitern (in `lib/types/chat-message.ts`); (b) Match auf `lastResultImageUrl`+`flowState === "reviewing"` für die jüngste Assistant-Message. Empfehlung (a) — explizit, persistierbar via Hydrate (Slice 28). Implementer entscheidet basierend auf existierender Message-Pipeline; entscheidung im PR begründen.
- Auto-Apply-Settle-Pfad in `use-assistant-runtime.ts`: an die Stelle, wo `generateImages()`-Resolve aus Slice 17 sitzt, den neuen Dispatch hängen; KEINE neue Watcher-Schleife
- Body-Field-Convention: snake_case (`last_result_image_url`) — passt zum Backend-Pydantic-DTO-Stil (architecture.md → "Migration Map" Zeile `backend/app/models/dtos.py`)
- Click-Pfad zur Detail-View: Implementer prüft, ob `usePromptAssistant()` einen `openDetailView(generationId)`-Helper bereits provided; falls nicht, fügt der Implementer in **diesem Slice** einen schmalen Helper ein, der intern den bestehenden Opener-Mechanismus aus `workspace-content.tsx:326-336` triggert (z.B. via Context-State-Toggle). Quelle der `generationId`: Auto-Apply speichert sie zusammen mit `lastResultImageUrl` (Implementer entscheidet, ob Reducer-Field um `lastResultGenerationId` erweitert wird oder ob aus URL → ID gemapped wird via existierender Generations-Quelle).
- Keyboard-Activation auf Thumbnail: Enter UND Space lösen denselben Handler aus
- Thumbnail-Größe: ~120px square, rounded, gemäss wireframes.md (kein neuer Design-Token nötig — Tailwind-Utility-Klassen)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/assistant/use-assistant-runtime.ts` | Edit: Ref-Pattern aus Zeilen 104-107 für `lastResultImageUrlRef`; Body-Builder Zeilen 354-373 erweitern |
| `lib/assistant/assistant-context.tsx` | Edit: `usePromptAssistant`-Hook Zeile 626 unverändert; Reducer-Branch ergänzen analog zu `SET_FLOW_STATE` (Slice 15) |
| `lib/types/chat-message.ts` | Optional Edit (siehe Constraints Pattern (a)): `resultImageUrl?: string` — Implementer entscheidet |
| `components/canvas/canvas-detail-view.tsx` | Import / Reuse — KEIN neues Modal, kein Wrap |
| `components/workspace/workspace-content.tsx:326-336` | Opener-Pattern (Detail-View-Mount via State-Toggle) — entweder direkt mitnutzen oder schmalen Helper im Assistant-Context spiegeln |
| `components/assistant/chat-thread.tsx` | Edit: neuer Render-Branch zwischen bestehenden Bubble-Variants — bestehende Branches (User-Bubble, Default-Assistant-Bubble, Cards aus 16/27) NICHT ändern |

**Referenzen:**
- Architecture: `architecture.md` → Sections "Business Logic Flow — Assistant Turn" (Body-Building inkl. `last_result_image_url`), "Multimodal Pipeline — Priority Order & Budget" (Priority 2 = Result-Image), "Frontend State Machine Wiring" → Tabellen-Zeile `generations.status flips to succeeded`, "Migration Map" Zeilen `lib/assistant/use-assistant-runtime.ts:354-373`, `lib/assistant/assistant-context.tsx:104-252`, `components/assistant/chat-thread.tsx`, "Out-of-DB persistence" Zeile `last_result_image_url`
- Wireframes: `wireframes.md` → "Screen: Reviewing Turn (after successful generate)" → Wireframe + Annotations ① + State Variations
- Discovery: `discovery.md` → Slice H "Result-Image als Multimodal für Refinement"; Business Rules Zeilen 286 (letztes Ergebnis pro Session) + 288 (Non-Vision-Fallback nur Backend); Q10 (Assistant sieht Result automatisch)
