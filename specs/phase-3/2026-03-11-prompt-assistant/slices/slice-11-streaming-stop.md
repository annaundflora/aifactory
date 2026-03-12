# Slice 11: Streaming-Anzeige + Stop-Button

> **Slice 11 von 22** fuer `Prompt Assistant`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-11-streaming-stop` |
| **Test** | `pnpm test components/assistant/__tests__/streaming-indicator.test.tsx components/assistant/__tests__/chat-input-streaming.test.tsx components/assistant/__tests__/chat-thread-streaming.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-10-core-chat-loop"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` (Next.js 16.1.6, React 19.2.3, pnpm, vitest) |
| **Test Command** | `pnpm test components/assistant/__tests__/streaming-indicator.test.tsx components/assistant/__tests__/chat-input-streaming.test.tsx components/assistant/__tests__/chat-thread-streaming.test.tsx` |
| **Integration Command** | `pnpm build` |
| **Acceptance Command** | `pnpm dev` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (PromptAssistantContext wird gemockt) |

---

## Ziel

Waehrend der Agent antwortet sollen visuelle Streaming-Indikatoren (animierte Punkte), zeichenweiser Text-Aufbau in der Assistant-Bubble und ein Stop-Button (statt Send-Button) angezeigt werden. Der Stop-Button bricht den SSE-Stream ab und behaelt den bisherigen Text. Der Chat-Input bleibt waehrend des Streamings aktiv.

---

## Acceptance Criteria

1) GIVEN der Agent streamt eine Antwort (`isStreaming === true`)
   WHEN die Chat-Thread Komponente gerendert wird
   THEN wird unterhalb der letzten Assistant-Message ein Streaming-Indicator mit 3 animierten Punkten angezeigt

2) GIVEN der Agent hat das Streaming beendet (`isStreaming === false`)
   WHEN die Chat-Thread Komponente gerendert wird
   THEN ist der Streaming-Indicator nicht sichtbar (nicht im DOM oder `hidden`)

3) GIVEN der Agent streamt `text-delta` Events
   WHEN die Events in der Assistant-Bubble ankommen
   THEN wird der Text zeichenweise aufgebaut -- jedes `text-delta` erweitert den sichtbaren Text der aktuellen Assistant-Message

4) GIVEN `isStreaming === true`
   WHEN der Chat-Input-Footer gerendert wird
   THEN ist der Send-Button (ArrowUp Icon) durch einen Stop-Button (Square Icon) ersetzt

5) GIVEN `isStreaming === false`
   WHEN der Chat-Input-Footer gerendert wird
   THEN wird der Send-Button (ArrowUp Icon) angezeigt (kein Stop-Button)

6) GIVEN der Agent streamt eine Antwort
   WHEN der User auf den Stop-Button klickt
   THEN wird `cancelStream()` aus dem `PromptAssistantContext` aufgerufen, der SSE-Stream wird abgebrochen, und der bisherige Text bleibt als Assistant-Message im Chat-Thread erhalten

7) GIVEN der Agent streamt eine Antwort
   WHEN der User in die Chat-Input Textarea tippt
   THEN bleibt die Textarea aktiv und nimmt Text entgegen -- der User kann waehrend des Streamings tippen

8) GIVEN der Agent streamt und der User hat Text in die Textarea eingegeben
   WHEN das Streaming endet (text-done oder Stop-Klick)
   THEN bleibt der eingegebene Text in der Textarea erhalten und der Send-Button wird wieder sichtbar (enabled, da Text vorhanden)

9) GIVEN der Stop-Button wird angeklickt und der Stream wird abgebrochen
   WHEN der Chat-Thread den Zustand aktualisiert
   THEN wird die abgebrochene Assistant-Message im Chat-Thread als regulaere (nicht-streamende) Message dargestellt, ohne Streaming-Indicator

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.
> **Syntax:** TypeScript/Vitest

### Test-Datei: `components/assistant/__tests__/streaming-indicator.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('StreamingIndicator', () => {
  // AC-1: Animierte Punkte sichtbar waehrend Streaming
  it.todo('should render 3 animated dots when visible prop is true')

  // AC-2: Nicht sichtbar wenn Streaming beendet
  it.todo('should not render when visible prop is false')
})
```
</test_spec>

### Test-Datei: `components/assistant/__tests__/chat-input-streaming.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ChatInput - Streaming Behavior', () => {
  // AC-4: Stop-Button statt Send-Button waehrend Streaming
  it.todo('should show stop button with Square icon when isStreaming is true')

  // AC-5: Send-Button wenn nicht Streaming
  it.todo('should show send button with ArrowUp icon when isStreaming is false')

  // AC-6: Stop-Button ruft cancelStream auf
  it.todo('should call onStop callback when stop button is clicked')

  // AC-7: Textarea bleibt aktiv waehrend Streaming
  it.todo('should keep textarea enabled and editable when isStreaming is true')

  // AC-8: Text bleibt nach Stream-Ende erhalten
  it.todo('should preserve textarea content after streaming ends')
})
```
</test_spec>

### Test-Datei: `components/assistant/__tests__/chat-thread-streaming.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ChatThread - Streaming Text Rendering', () => {
  // AC-3: Zeichenweiser Text-Aufbau
  it.todo('should render assistant message text progressively as text-delta events arrive')

  // AC-1: Streaming-Indicator unterhalb der letzten Assistant-Message
  it.todo('should show streaming indicator below last assistant message when isStreaming is true')

  // AC-9: Abgebrochene Message wird als regulaere Message dargestellt
  it.todo('should display cancelled message as regular completed message without streaming indicator')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-10-core-chat-loop | `PromptAssistantContext` | React Context | `isStreaming`, `cancelStream()`, `messages` sind verfuegbar |
| slice-10-core-chat-loop | `ChatThread` Component | Component | Wird erweitert um Streaming-Rendering und Indicator |
| slice-09-startscreen-chips | `ChatInput` Component | Component | Wird erweitert um `isStreaming` und `onStop` Props |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `StreamingIndicator` | Component | slice-14 (Canvas Panel, Drafting-State) | `<StreamingIndicator visible={boolean}>` |
| `ChatInput` (erweitert) | Component | slice-17 (Image Upload) | `<ChatInput onSend onStop isStreaming disabled autoFocus>` |
| `ChatThread` (erweitert) | Component | slice-14 (Split-View) | `<ChatThread messages isStreaming>` mit Streaming-Text-Rendering |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/assistant/streaming-indicator.tsx` -- Animierte 3-Punkte Komponente, gesteuert via `visible` Prop
- [ ] `components/assistant/chat-input.tsx` (erweitert) -- Stop-Button (Square Icon) ersetzt Send-Button waehrend `isStreaming`, Textarea bleibt aktiv
- [ ] `components/assistant/chat-thread.tsx` (erweitert) -- Zeichenweiser Text-Aufbau in Assistant-Bubble, Streaming-Indicator Integration
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice implementiert KEINE Error-Retry-Logik oder Error-Bubbles (kommt in Slice 22)
- Dieser Slice implementiert KEIN Canvas-Panel oder Split-View (kommt in Slice 14)
- Dieser Slice implementiert KEINE Image-Upload Funktionalitaet (kommt in Slice 17)
- Die `cancelStream()` Funktion wird aus dem `PromptAssistantContext` (Slice 10) konsumiert -- falls sie dort noch nicht implementiert ist, muss sie in diesem Slice dem Context hinzugefuegt werden (AbortController auf dem fetch-Call)

**Technische Constraints:**
- Streaming-Indicator: CSS-Animation (Tailwind `animate-pulse` oder Custom Keyframes), keine JS-basierte Animation
- Stop-Button Icon: `Square` aus `lucide-react` (wie in discovery.md definiert)
- Send-Button Icon: `ArrowUp` aus `lucide-react` (bestehend aus Slice 09)
- `ChatInput` erhaelt neue Props: `isStreaming: boolean` und `onStop: () => void`
- Textarea bleibt `enabled` waehrend Streaming -- kein `disabled` Attribut setzen
- Der zeichenweise Text-Aufbau ist bereits durch den SSE `text-delta` Mechanismus aus Slice 10 gegeben -- dieser Slice stellt sicher, dass die Darstellung in der Bubble korrekt ist

**Referenzen:**
- Wireframes: `specs/phase-3/2026-03-11-prompt-assistant/wireframes.md` -> Section "Screen: Chatting (No Canvas)", State Variation "streaming"
- Wireframes: `specs/phase-3/2026-03-11-prompt-assistant/wireframes.md` -> Section "Screen: Chatting with Image Upload" (Streaming-Indicator Annotation 2)
- Discovery: `specs/phase-3/2026-03-11-prompt-assistant/discovery.md` -> Section "UI Components & States" (streaming-indicator, stop-btn, chat-input States)
- Discovery: `specs/phase-3/2026-03-11-prompt-assistant/discovery.md` -> Section "Feature State Machine" (streaming -> chatting Transition via stop-btn)
