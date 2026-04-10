# Slice 1: downloadImage Web Share API Branch

> **Slice 1 von 2** fuer `iPad Canvas Download Fix + Gallery Scroll Restore`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-01-download-web-share` |
| **Test** | `pnpm vitest run lib/__tests__/download-utils.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm vitest run lib/__tests__/download-utils.test.ts` |
| **Integration Command** | -- |
| **Acceptance Command** | -- |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | -- |
| **Mocking Strategy** | `mock_external` (navigator.share, navigator.canShare, fetch via vi.stubGlobal / vi.spyOn) |

---

## Ziel

`downloadImage()` in `lib/utils.ts` um einen Web Share API Branch erweitern, sodass auf Geraeten mit File-Sharing-Support (iOS/iPadOS) das native Share-Sheet statt eines Anchor-Clicks verwendet wird. Das behebt den iPad-Safari-Bug, bei dem Blob-URL-Navigation die SPA zerstoert. Die Funktions-Signatur `(url: string, filename: string) => Promise<void>` bleibt unveraendert.

---

## Acceptance Criteria

1) GIVEN `navigator.canShare` existiert und `navigator.canShare({ files: [File] })` gibt `true` zurueck
   WHEN `downloadImage(url, filename)` aufgerufen wird
   THEN wird `navigator.share({ files: [file] })` mit einem `File`-Objekt aufgerufen, das aus dem gefetchten Blob erstellt wurde (Filename = `filename`-Parameter, Type = `blob.type`), und `URL.revokeObjectURL` wird nach Abschluss des Share-Calls aufgerufen

2) GIVEN `navigator.canShare` existiert nicht ODER `navigator.canShare({ files: [File] })` gibt `false` zurueck
   WHEN `downloadImage(url, filename)` aufgerufen wird
   THEN wird der bestehende Anchor-Click-Pfad ausgefuehrt (createElement "a", href = objectURL, download = filename, appendChild, click, removeChild, revokeObjectURL)

3) GIVEN Web Share API ist verfuegbar und `navigator.share()` rejected mit einem Error dessen `name === "AbortError"` (User schliesst Share-Sheet)
   WHEN `downloadImage(url, filename)` aufgerufen wird und der User das Share-Sheet dismissed
   THEN resolved die Funktion normal (`Promise<void>` ohne throw), `URL.revokeObjectURL` wird trotzdem aufgerufen

4) GIVEN Web Share API ist verfuegbar und `navigator.share()` rejected mit einem Error dessen `name !== "AbortError"` (z.B. `NotAllowedError`)
   WHEN `downloadImage(url, filename)` aufgerufen wird
   THEN wird der Error re-thrown (propagiert zum Caller fuer Toast-Handling), `URL.revokeObjectURL` wird trotzdem aufgerufen

5) GIVEN bestehende Tests in `download-utils.test.ts` (AC-6, AC-7 aus frueherem Slice)
   WHEN `pnpm vitest run lib/__tests__/download-utils.test.ts` ausgefuehrt wird
   THEN bleiben alle bestehenden Tests gruen (keine Regression)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.
> **Syntax:** TypeScript/Vitest (erkannter Stack).

### Test-Datei: `lib/__tests__/download-utils.test.ts`

<test_spec>
```typescript
// Neue Tests innerhalb des bestehenden `describe("downloadImage", ...)` Blocks hinzufuegen.
// Bestehende Tests (AC-6, AC-7) NICHT veraendern.
// Vitest-Environment: jsdom (bereits konfiguriert in Zeile 1)
// navigator.canShare und navigator.share muessen via vi.stubGlobal oder
// Object.defineProperty gemockt werden (jsdom stellt diese nicht bereit).

// AC-1: Web Share API Branch
it.todo('should call navigator.share with File when canShare returns true and revoke objectURL after share resolves')

// AC-2: Anchor-Click Fallback
it.todo('should fall back to anchor-click when canShare is not available')

// AC-2b: Anchor-Click Fallback (canShare returns false)
it.todo('should fall back to anchor-click when canShare returns false')

// AC-3: AbortError silent
it.todo('should resolve without throwing when navigator.share rejects with AbortError')

// AC-4: Non-AbortError re-throw
it.todo('should re-throw when navigator.share rejects with non-AbortError')

// AC-5: Regression (implizit durch bestehende Tests — kein neuer Test noetig)
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| -- | -- | -- | Erster Slice, keine Dependencies |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `downloadImage` | Function | `slice-02-gallery-scroll` (indirekt, keine direkte Abhaengigkeit) | `(url: string, filename: string) => Promise<void>` (Signatur unveraendert) |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/utils.ts` -- `downloadImage()` erweitern: Web Share API Branch nach Blob-Fetch, AbortError-Handling, Anchor-Click-Fallback
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderung an `canvas-toolbar.tsx` (AbortError wird in `downloadImage` selbst behandelt, Signatur bleibt gleich)
- KEINE Aenderung an `workspace-content.tsx` (Gallery Scroll = Slice 2)
- KEINE neuen npm Dependencies (Web Share API ist Browser-Standard)
- KEINE User-Agent-Sniffing (Codebase-Konvention: Feature Detection)
- KEINE Aenderung der Funktions-Signatur von `downloadImage`

**Technische Constraints:**
- Feature Detection via `navigator.canShare({ files: [file] })` NACH Blob-Fetch (nicht mit Dummy-File davor)
- `File`-Objekt erstellen mit `new File([blob], filename, { type: blob.type })`
- `URL.revokeObjectURL` im Share-Pfad erst NACH `await navigator.share()` (resolved oder rejected), nicht im globalen finally
- AbortError-Check via `error.name === "AbortError"` (nicht instanceof, da DOMException)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/utils.ts` (L53-73, `downloadImage`) | EXTEND: Web Share API Branch hinzufuegen, bestehenden Anchor-Click-Pfad als Fallback beibehalten |
| `components/canvas/canvas-toolbar.tsx` | REUSE unveraendert -- Signatur von `downloadImage` bleibt gleich, kein Change noetig |

**Referenzen:**
- Architecture: `architecture.md` -> Section "Migration Map" (downloadImage Change-Details)
- Architecture: `architecture.md` -> Section "Error Handling Strategy" (AbortError-Behandlung)
- Architecture: `architecture.md` -> Section "Constraints & Integrations" (Transient Activation, revokeObjectURL Timing)
- Discovery: `discovery.md` -> Section "User Flow" -> Flow 1 (Download auf iPad)
