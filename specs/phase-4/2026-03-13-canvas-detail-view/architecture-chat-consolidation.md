# Delta-Architecture: Canvas Chat Consolidation

**Epic:** AI Image Studio - Phase 4
**Status:** Ready
**Base Architecture:** `architecture.md` (same folder)
**Derived from:** Code-Review der Worktree-Implementierung — Canvas-Chat wurde parallel zum Prompt-Assistenten implementiert statt Infrastruktur wiederzuverwenden

---

## Problem & Solution

**Problem:**
- Canvas-Chat im Worktree ist eine Parallel-Implementierung zum existierenden Prompt-Assistenten
- SSE-Parser (`parseSSEChunk`) ist eine Kopie von `parseSSEEvents` aus `use-assistant-runtime.ts`
- Stream-Consumer (Buffer, Decode, Boundary-Detection) ist ~40 Zeilen identischer Code in beiden Implementierungen
- Wartungsaufwand verdoppelt sich bei SSE-Bugfixes oder Protokoll-Aenderungen
- Die Base-Architecture (Zeile 295-297, 393) sah Wiederverwendung vor, die nicht umgesetzt wurde

**Solution:**
- Shared SSE-Infrastruktur als `lib/shared/sse-stream.ts` extrahieren
- Canvas-Chat-Service als duenne Schicht ueber shared Utilities refactoren
- Canvas-spezifische Logik (Chips, Separator, Init-Message, Event-Handling) bleibt

**Nicht im Scope:**
- Prompt-Assistent wird NICHT veraendert
- Backend bleibt wie implementiert (separater Agent ist architektonisch korrekt)
- Canvas-Chat-Input und Canvas-Chat-Messages bleiben unveraendert

---

## Scope & Boundaries

| In Scope |
|----------|
| Shared SSE-Parser + Stream-Consumer Utility erstellen |
| Canvas-Chat-Service refactoren: shared Utilities statt eigener Implementierung |
| Tests fuer shared Utility + angepasste Canvas-Service-Tests |

| Out of Scope |
|--------------|
| Prompt-Assistent Refactoring (keine Aenderungen an `lib/assistant/` oder `components/assistant/`) |
| Backend-Konsolidierung (separate Endpunkte + Agent bleiben) |
| Shared ChatInput Komponente (Canvas-Input bleibt eigenstaendig) |
| Shared Message-Rendering (Canvas-Messages mit Chips/Separator bleiben eigenstaendig) |

---

## Shared Utility: `lib/shared/sse-stream.ts`

### API

| Export | Signatur | Beschreibung |
|--------|----------|--------------|
| `parseSSEEvents` | `(rawText: string) => Array<{ event: string; data: string }>` | Parst SSE-Text in typisierte Events. Identisch mit `parseSSEEvents` aus `use-assistant-runtime.ts`. |
| `consumeSSEStream` | `(response: Response, onEvent: SSEEventHandler, options?: ConsumeSSEOptions) => Promise<void>` | Liest SSE-Stream mit Buffer/Decode/Boundary-Detection. Ruft `onEvent` pro Event auf. |
| `SSEEventHandler` | `(eventType: string, rawData: string) => void` | Callback-Type fuer Event-Verarbeitung |
| `ConsumeSSEOptions` | `{ signal?: AbortSignal; timeoutMs?: number }` | Optional: AbortSignal fuer Cancellation, Timeout in ms |

### Verhalten

| Aspekt | Spezifikation |
|--------|---------------|
| Buffer-Handling | UTF-8 Decode mit `{ stream: true }`, Boundary-Detection via `\n\n` |
| Incomplete Events | Bleiben im Buffer bis naechster Chunk kommt oder Stream endet |
| Timeout (optional) | Wenn `timeoutMs` gesetzt und kein Event innerhalb der Frist: `onEvent("error", ...)` mit Timeout-Message |
| Timeout-Reset | Jeder empfangene Event resettet den Timeout-Timer |
| Stream-Ende | Remaining Buffer wird geflusht (Events ohne trailing `\n\n`) |
| AbortSignal | Bricht Read-Loop ab, kein Error-Event |
| Error bei null body | Wirft Error `"Response body is null"` |

### Timeout-Race-Pattern

```
while (true):
  if timeoutMs set:
    race(reader.read(), timeout-promise)
    if timeout wins → emit error event, break
  else:
    reader.read()

  decode + buffer
  parse complete events via parseSSEEvents()
  call onEvent() per event, reset timeout timer
```

---

## Migration Map

### Neue Dateien

| Datei | Zweck |
|-------|-------|
| `worktrees/canvas-detail-view/lib/shared/sse-stream.ts` | Shared SSE-Parser + Stream-Consumer |
| `worktrees/canvas-detail-view/lib/shared/__tests__/sse-stream.test.ts` | Tests fuer shared Utility |

### Geaenderte Dateien

| Datei | Aktuelle Implementierung | Ziel-Implementierung | Konkrete Aenderungen |
|-------|--------------------------|---------------------|---------------------|
| `worktrees/canvas-detail-view/lib/canvas-chat-service.ts` | Eigener SSE-Parser (`parseSSEChunk`), eigener Stream-Consumer mit Buffer/Decode/Boundary-Detection/Timeout in `sendMessage()` | Duenne Schicht: importiert `consumeSSEStream` + `parseSSEEvents` aus `lib/shared/sse-stream.ts`. `sendMessage()` wird zum Wrapper. | 1. `parseSSEChunk()` entfernen. 2. `parseSSEEvent()` bleibt (Canvas-spezifisches Event-Mapping). 3. `sendMessage()` ruft `consumeSSEStream()` mit `parseSSEEvent` als Handler auf. 4. Timeout (60s) wird via `options.timeoutMs` an `consumeSSEStream` uebergeben. 5. `createSession()` bleibt unveraendert. 6. DTOs und SSE-Event-Types bleiben unveraendert. |
| `worktrees/canvas-detail-view/lib/__tests__/canvas-chat-service.test.ts` | Tests fuer SSE-Parsing + Timeout + Event-Types | SSE-Parsing-Tests verschieben nach `lib/shared/__tests__/sse-stream.test.ts`. Service-Tests testen nur noch Canvas-spezifisches Event-Mapping und Session-Creation. | 1. SSE-Chunk-Parsing-Tests entfernen (nach shared verschoben). 2. Timeout-Tests anpassen (testen dass `timeoutMs: 60000` an `consumeSSEStream` uebergeben wird). 3. `parseSSEEvent()` Tests bleiben (Canvas-spezifisch). |

### Unveraenderte Dateien

| Datei | Grund |
|-------|-------|
| `worktrees/canvas-detail-view/components/canvas/canvas-chat-panel.tsx` | Nutzt `canvas-chat-service.ts` als Abstraction — kein direkter Zugriff auf SSE-Infrastruktur |
| `worktrees/canvas-detail-view/components/canvas/canvas-chat-input.tsx` | Canvas-spezifischer Input (einfacher als Prompt-Assistent), bleibt |
| `worktrees/canvas-detail-view/components/canvas/canvas-chat-messages.tsx` | Canvas-spezifische Darstellung (Chips, Separator, Init-Message), bleibt |
| `worktrees/canvas-detail-view/lib/types/chat-message.ts` | Canvas-spezifischer Message-Type, bleibt |
| `worktrees/canvas-detail-view/backend/app/routes/canvas_sessions.py` | Separater Agent = separate Endpunkte (architektonisch korrekt) |
| `worktrees/canvas-detail-view/backend/app/services/canvas_assistant_service.py` | Separater Service fuer separaten Agent |
| `worktrees/canvas-detail-view/backend/app/agent/canvas_graph.py` | Eigener LangGraph-Agent mit `generate_image` Tool |
| Alle `components/assistant/` Dateien | Prompt-Assistent wird NICHT veraendert |
| `lib/assistant/use-assistant-runtime.ts` | Prompt-Assistent wird NICHT veraendert |

---

## Refactored `canvas-chat-service.ts` — Ziel-Struktur

```
canvas-chat-service.ts (NACH Refactor)
├── DTOs (unveraendert)
│   ├── CanvasImageContext
│   ├── SSETextDeltaEvent, SSETextDoneEvent, SSECanvasGenerateEvent, SSEErrorEvent
│   └── CanvasSSEEvent (Union Type)
│
├── parseSSEEvent(eventType, rawData) → CanvasSSEEvent | null
│   (Canvas-spezifisches Mapping: text-delta, text-done, canvas-generate, error)
│   (BLEIBT — das ist die kontextspezifische Logik)
│
├── createSession(projectId, imageContext) → Promise<string>
│   (BLEIBT unveraendert — POST /api/assistant/canvas/sessions)
│
└── sendMessage(sessionId, content, imageContext, signal?) → AsyncGenerator<CanvasSSEEvent>
    (REFACTORED — nutzt consumeSSEStream() intern)

    Intern:
    1. fetch() POST mit content + image_context
    2. Collected events array + consumeSSEStream(response, onEvent, { signal, timeoutMs: 60000 })
    3. onEvent ruft parseSSEEvent() auf, pushed in collected array
    4. yield* collected events (oder Callback-Pattern statt AsyncGenerator)
```

### Option: AsyncGenerator beibehalten vs. Callback-Pattern

| Ansatz | Pro | Con |
|--------|-----|-----|
| **AsyncGenerator beibehalten** | `canvas-chat-panel.tsx` bleibt unveraendert (`for await...of`). Minimale Aenderung. | `consumeSSEStream` ist callback-basiert, sendMessage muss intern puffern oder Channel-Pattern nutzen. |
| **Auf Callbacks umstellen** | `sendMessage` wird simpler, `canvas-chat-panel.tsx` nutzt Callbacks direkt. | Aenderung an `canvas-chat-panel.tsx` noetig (for-await-of Loop ersetzen durch Callback-Registrierung). |

**Empfehlung:** Callback-Pattern. `canvas-chat-panel.tsx` hat bereits einen `switch`-Block fuer Event-Types — der wird zum `onEvent` Callback. Die AsyncGenerator-Abstraktion in `sendMessage` entfaellt, was den Code vereinfacht.

---

## Refactored Data Flow

```
VORHER:
  canvas-chat-panel.tsx
    → canvas-chat-service.ts
      → parseSSEChunk()           ← DUPLIZIERT
      → Buffer/Decode/Boundary    ← DUPLIZIERT
      → parseSSEEvent()           ← Canvas-spezifisch
      → yield CanvasSSEEvent

NACHHER:
  canvas-chat-panel.tsx
    → canvas-chat-service.ts
      → consumeSSEStream()        ← SHARED (lib/shared/sse-stream.ts)
        → parseSSEEvents()        ← SHARED (lib/shared/sse-stream.ts)
      → parseSSEEvent()           ← Canvas-spezifisch (bleibt in canvas-chat-service.ts)
      → Callback mit CanvasSSEEvent
```

---

## Risks & Assumptions

### Assumptions

| Assumption | Validation | Impact if Wrong |
|------------|-----------|-----------------|
| `parseSSEEvents` in `use-assistant-runtime.ts` und `parseSSEChunk` in `canvas-chat-service.ts` sind funktional identisch | Code-Vergleich bestaetigt: identische Logik, nur Funktionsname unterschiedlich | Wenn divergiert: Unit-Tests fangen Differenzen |
| Prompt-Assistent importiert NICHT aus `lib/shared/` | Keine Aenderung an Prompt-Assistent-Code | Kein Risiko — Forward-Compatibility fuer spaeteres Refactoring |
| Callback-Pattern ist kompatibel mit `canvas-chat-panel.tsx` Event-Loop | Panel hat bereits switch-Block der Events verarbeitet | Minimale Umstrukturierung des for-await-of Loops |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Temporaere Duplizierung von `parseSSEEvents` (existiert in shared UND in use-assistant-runtime.ts) | Sicher | Niedrig | Akzeptiert: Prompt-Assistent kann spaeter auf shared umgestellt werden. Beide sind identisch, kein Wartungs-Risiko. |
| `consumeSSEStream` Timeout-Verhalten weicht subtil vom Original ab | Niedrig | Mittel | Unit-Tests fuer Timeout-Edge-Cases (race condition, partial events bei Timeout) |

---

## Implementation Slices

| # | Name | Scope | Testability | Dependencies |
|---|------|-------|-------------|--------------|
| 1 | Shared SSE Utility | `lib/shared/sse-stream.ts` mit `parseSSEEvents` + `consumeSSEStream`. Unit-Tests. | Parser-Tests (multi-event, partial, malformed), Stream-Consumer-Tests (mock ReadableStream, timeout, abort) | -- |
| 2 | Canvas-Chat-Service Refactor | `canvas-chat-service.ts` refactoren: eigenen Parser/Consumer entfernen, shared importieren. `canvas-chat-panel.tsx` auf Callback-Pattern umstellen. Bestehende Tests anpassen. | Bestehende Integration-Tests muessen weiterhin bestehen. Service-Tests testen nur Canvas-spezifisches Mapping. | Slice 1 |

---

## Q&A Log

| # | Frage | Antwort |
|---|-------|---------|
| 1 | Wurde in der Worktree-Implementierung sinnvoll wiederverwendet? | Nein, fast nichts wurde wiederverwendet. Nur `StreamingIndicator` wird importiert. SSE-Parser, Stream-Consumer, Chat-Input, Backend-Service, Rate-Limiter — alles parallel neu gebaut. |
| 2 | Was ist das Ziel? | Konsolidierung: Shared Chat-Infrastruktur extrahieren. |
| 3 | Welche Konsolidierungs-Tiefe? | Chat darf im Detail-View anders funktionieren (rich replies, Chips, anderer Agent). Alles andere (SSE-Parsing, Streaming, Backend-Patterns) soll wiederverwendet werden. |
| 4 | Soll der Prompt-Assistent veraendert werden? | Nein, nur Canvas anpassen. |
| 5 | Wo liegt die Grenze der Wiederverwendung beim Event-Handling? | SSE-Parser + Stream-Consumer als shared Utility. Event-Handler als Callback injizieren. Kein Full-Runtime-Sharing (waere Over-Engineering). |
| 6 | Soll die Spec Worktree- oder Projekt-Pfade verwenden? | Worktree-Pfade (`worktrees/canvas-detail-view/...`). |
