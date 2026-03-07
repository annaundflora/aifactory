# Slice 20: OpenRouter Client Timeout

> **Slice 20** fuer `quality-improvements`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-20-openrouter-timeout` |
| **Test** | `pnpm vitest run lib/clients/__tests__/openrouter.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm vitest run lib/clients/__tests__/openrouter.test.ts` |
| **Integration Command** | `--` |
| **Acceptance Command** | `--` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `--` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Den OpenRouter-Client (`lib/clients/openrouter.ts`) um einen konfigurierbaren Fetch-Timeout via `AbortController` erweitern. Default-Timeout: 30 Sekunden. Optionaler `timeout`-Parameter in der `chat()`-Methode ermoeglicht kuerzere Timeouts (z.B. 15s fuer Thumbnail-Calls).

---

## Acceptance Criteria

1) GIVEN der OpenRouter-Client wird ohne `timeout`-Parameter aufgerufen
   WHEN `chat()` ausgefuehrt wird
   THEN wird ein `AbortController` mit 30000ms Timeout an den `fetch()`-Call uebergeben

2) GIVEN der OpenRouter-Client wird mit `timeout: 15000` aufgerufen
   WHEN `chat()` ausgefuehrt wird
   THEN wird ein `AbortController` mit 15000ms Timeout an den `fetch()`-Call uebergeben

3) GIVEN ein laufender `chat()`-Call
   WHEN der konfigurierte Timeout ueberschritten wird
   THEN wird der Fetch abgebrochen und ein Fehler mit aussagekraeftiger Nachricht geworfen (enthaelt "timeout" und die konfigurierte Dauer in Sekunden)

4) GIVEN ein laufender `chat()`-Call mit AbortController
   WHEN der Call erfolgreich vor dem Timeout abschliesst
   THEN wird der Timeout-Timer aufgeraeumt (clearTimeout) um Memory Leaks zu vermeiden

5) GIVEN das bestehende `ChatParams`-Interface
   WHEN der `timeout`-Parameter hinzugefuegt wird
   THEN ist er optional (`timeout?: number`) und bricht keine bestehenden Aufrufer

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.

### Test-Datei: `lib/clients/__tests__/openrouter.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('OpenRouter Client Timeout', () => {
  // AC-1: Default Timeout
  it.todo('should use 30000ms as default timeout when no timeout parameter is provided')

  // AC-2: Custom Timeout
  it.todo('should use the provided timeout value when timeout parameter is specified')

  // AC-3: Timeout Error
  it.todo('should throw a descriptive timeout error when the configured timeout is exceeded')

  // AC-4: Timer Cleanup
  it.todo('should clear the timeout timer after a successful response')

  // AC-5: Backward Compatibility
  it.todo('should accept calls without timeout parameter without breaking existing interface')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| -- | -- | -- | -- |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `openRouterClient.chat()` | Function | Prompt-Service, Thumbnail-Service | `chat(params: ChatParams): Promise<string>` mit optionalem `timeout?: number` in `ChatParams` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/clients/openrouter.ts` — AbortController-basierter Timeout mit Default 30s, optionaler `timeout`-Parameter in `ChatParams`
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Keine Aenderungen an der Response-Verarbeitung oder Fehlerbehandlung (ausser Timeout-Fehler)
- Kein Retry-Mechanismus (nicht in Scope)
- Keine Aenderung der bestehenden Aufrufer (prompt-service.ts, etc.) — diese uebergeben `timeout` erst in ihren eigenen Slices

**Technische Constraints:**
- Nutze `AbortController` + `AbortSignal.timeout()` oder manuelles `setTimeout` + `controller.abort()` (Node.js-kompatibel)
- Timer MUSS nach erfolgreichem Call aufgeraeumt werden (`clearTimeout`)
- Fehler-Nachricht bei Timeout MUSS die konfigurierte Dauer enthalten (fuer Debugging)

**Referenzen:**
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` → Section "External API Constraints" (Timeout-Anforderungen: 30s Default, 15s fuer Thumbnails)
- Bestehender Client: `lib/clients/openrouter.ts` (aktuell ohne Timeout)
