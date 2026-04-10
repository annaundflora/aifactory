# Slice 2: Toolbar handleDownload AbortError-Kompatibilitaet verifizieren

> **Slice 2 von 2** fuer `iPad Canvas Download Fix + Gallery Scroll Restore`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-02-toolbar-abort-handling` |
| **Test** | `pnpm vitest run components/canvas/__tests__/canvas-toolbar.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-download-web-share"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm vitest run components/canvas/__tests__/canvas-toolbar.test.tsx` |
| **Integration Command** | -- |
| **Acceptance Command** | -- |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | -- |
| **Mocking Strategy** | `mock_external` (downloadImage via vi.mock, sonner toast via vi.mock) |

---

## Ziel

Verifizieren, dass `handleDownload()` in `canvas-toolbar.tsx` (L87-101) kompatibel mit dem in Slice 01 geaenderten `downloadImage()` ist. Da `downloadImage()` nach Slice 01 bei AbortError still resolved (kein throw), erreicht kein AbortError den catch-Block in der Toolbar. Dieser Slice ist primaer ein **Verifikations-Slice mit Test**: Es wird geprueft, dass der bestehende catch-Block nur echte Fehler abfaengt und bei AbortError kein Toast gezeigt wird.

---

## Acceptance Criteria

1) GIVEN `downloadImage()` resolved normal (z.B. nach erfolgreichem Share oder nach User-Dismiss mit AbortError, der in `downloadImage` selbst abgefangen wird)
   WHEN `handleDownload()` in der Toolbar ausgefuehrt wird
   THEN wird `toast.error` NICHT aufgerufen und `isDownloading` wechselt zurueck auf `false`

2) GIVEN `downloadImage()` rejected mit einem echten Fehler (z.B. `TypeError: Failed to fetch`)
   WHEN `handleDownload()` in der Toolbar ausgefuehrt wird
   THEN wird `toast.error("Download fehlgeschlagen")` genau einmal aufgerufen und `isDownloading` wechselt zurueck auf `false`

3) GIVEN `handleDownload()` wird aufgerufen und `downloadImage()` ist in Ausfuehrung (Promise pending)
   WHEN der User erneut auf den Download-Button klickt
   THEN wird kein zweiter `downloadImage()`-Aufruf gestartet (Guard: `isDownloading` ist `true`)

4) GIVEN bestehende Tests in `canvas-toolbar.test.tsx` (AC-1 bis AC-10)
   WHEN `pnpm vitest run components/canvas/__tests__/canvas-toolbar.test.tsx` ausgefuehrt wird
   THEN bleiben alle bestehenden 10 Tests gruen (keine Regression)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.
> **Syntax:** TypeScript/Vitest (erkannter Stack).

### Test-Datei: `components/canvas/__tests__/canvas-toolbar.test.tsx`

<test_spec>
```typescript
// Neue Tests innerhalb des bestehenden `describe("CanvasToolbar", ...)` Blocks hinzufuegen.
// Bestehende Tests (AC-1 bis AC-10) NICHT veraendern.
// Mock `mockDownloadImage` ist bereits definiert (L50) -- Resolve/Reject-Verhalten pro Test steuern.
// `toast` ist bereits gemockt (L60-62).

// AC-1: Kein Toast bei normalem Resolve (AbortError wird in downloadImage geschluckt)
it.todo('should not show error toast when downloadImage resolves successfully (AbortError handled internally)')

// AC-2: Toast bei echtem Fehler
it.todo('should show toast.error "Download fehlgeschlagen" when downloadImage rejects with a real error')

// AC-3: Doppelklick-Guard
it.todo('should not call downloadImage a second time while a download is already in progress')

// AC-4: Regression (implizit durch bestehende Tests -- kein neuer Test noetig)
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-download-web-share` | `downloadImage` | Function | Signatur `(url: string, filename: string) => Promise<void>` unveraendert. AbortError wird intern abgefangen, nur echte Fehler werden geworfen. |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| -- | -- | -- | Letzter Slice, keine Nachfolger |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/canvas/canvas-toolbar.tsx` -- Verifizieren, dass `handleDownload()` (L87-101) kompatibel ist. Wahrscheinlich kein Code-Change noetig (reiner Verifikations-Slice). Falls doch: Error-Typ-Check im catch-Block ergaenzen.
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderung an `lib/utils.ts` (das ist Slice 01)
- KEINE Aenderung an `workspace-content.tsx` (Gallery Scroll ist nicht Teil dieses Tickets)
- KEINE neuen npm Dependencies
- KEINE Aenderung der bestehenden 10 Tests in `canvas-toolbar.test.tsx`

**Technische Constraints:**
- `handleDownload()` nutzt blanken `catch {}` Block (L96-98). Da `downloadImage()` nach Slice 01 bei AbortError still resolved, ist der catch-Block bereits kompatibel -- er faengt nur echte Fehler ab.
- Falls wider Erwarten doch ein AbortError den catch-Block erreicht: Error-Typ-Check via `error.name === "AbortError"` ergaenzen (identisches Pattern wie `openrouter.ts:70` und `settings-dialog.tsx:241` in der Codebase).
- `isDownloading`-State dient als Doppelklick-Guard (L88, L89, L99). Muss korrekt zurueckgesetzt werden in beiden Pfaden (success + error).

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/canvas/canvas-toolbar.tsx` (L87-101, `handleDownload`) | VERIFY Kompatibilitaet, ggf. minimaler MODIFY |
| `components/canvas/__tests__/canvas-toolbar.test.tsx` | EXTEND: 3 neue Tests hinzufuegen (Test-Writer-Agent) |

**Referenzen:**
- Architecture: `architecture.md` -> Section "Error Handling Strategy" (AbortError = kein Toast, andere Fehler = Toast)
- Architecture: `architecture.md` -> Section "Migration Map" -> `canvas-toolbar.tsx` Eintrag ("Unveraendert" da AbortError in downloadImage behandelt wird)
- Slice 01: `slice-01-download-web-share.md` -> AC-3 (AbortError resolved still) und AC-4 (Non-AbortError re-thrown)
