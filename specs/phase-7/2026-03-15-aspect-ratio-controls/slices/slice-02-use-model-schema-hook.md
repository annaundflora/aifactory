# Slice 2: useModelSchema Hook erstellen

> **Slice 2 von 4** fuer `Model Parameter Controls (Aspect Ratio, Size & Advanced)`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-02-use-model-schema-hook` |
| **Test** | `pnpm test lib/hooks/use-model-schema.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-resolve-model-utility"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/hooks/use-model-schema.test.ts` |
| **Integration Command** | n/a |
| **Acceptance Command** | `pnpm tsc --noEmit` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | n/a |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Einen React Hook `useModelSchema` erstellen, der die bestehende `getModelSchema` Server Action aufruft, um das Schema fuer eine gegebene `modelId` zu laden. Der Hook verwaltet `schema`, `isLoading` und `error` State, refetcht bei `modelId`-Aenderung und gibt `null`-Schema bei `undefined` modelId zurueck. Dies ist die Grundlage fuer alle UI-Integrationen in Slices 3 und 4.

---

## Acceptance Criteria

1) GIVEN `modelId` ist `"black-forest-labs/flux-schnell"` (gueltiges Model)
   WHEN `useModelSchema(modelId)` aufgerufen wird und die Server Action erfolgreich `{ properties: { aspect_ratio: { type: "string", enum: ["1:1", "16:9"] } } }` zurueckgibt
   THEN gibt der Hook `{ schema: { properties: { aspect_ratio: ... } }, isLoading: false, error: null }` zurueck

2) GIVEN `modelId` ist `"black-forest-labs/flux-schnell"`
   WHEN `useModelSchema(modelId)` aufgerufen wird und die Server Action noch laeuft
   THEN gibt der Hook `{ schema: null, isLoading: true, error: null }` zurueck

3) GIVEN `modelId` ist `"black-forest-labs/flux-schnell"`
   WHEN `useModelSchema(modelId)` aufgerufen wird und die Server Action `{ error: "Model not found" }` zurueckgibt
   THEN gibt der Hook `{ schema: null, isLoading: false, error: "Model not found" }` zurueck (kein throw)

4) GIVEN `modelId` ist `undefined`
   WHEN `useModelSchema(undefined)` aufgerufen wird
   THEN gibt der Hook sofort `{ schema: null, isLoading: false, error: null }` zurueck OHNE die Server Action aufzurufen

5) GIVEN der Hook wurde mit `modelId = "black-forest-labs/flux-schnell"` aufgerufen und hat ein Schema geladen
   WHEN `modelId` sich zu `"google/nano-banana-2"` aendert
   THEN ruft der Hook die Server Action erneut mit der neuen `modelId` auf und gibt das neue Schema zurueck

6) GIVEN der Hook wurde mit `modelId = "black-forest-labs/flux-schnell"` aufgerufen
   WHEN die Server Action laeuft und `modelId` sich zu `"google/nano-banana-2"` aendert bevor die Antwort kommt
   THEN wird die veraltete Antwort fuer `flux-schnell` verworfen (kein stale-State-Update)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/hooks/use-model-schema.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('useModelSchema', () => {
  // AC-1: Gibt Schema zurueck bei gueltigem modelId nach erfolgreichem Fetch
  it.todo('should return schema with isLoading=false after successful fetch')

  // AC-2: Zeigt Loading-State waehrend Server Action laeuft
  it.todo('should return isLoading=true while server action is pending')

  // AC-3: Setzt error State bei fehlgeschlagenem Fetch (kein throw)
  it.todo('should return error string and schema=null when server action returns error')

  // AC-4: Gibt null-Schema bei undefined modelId zurueck ohne Server Action aufzurufen
  it.todo('should return schema=null, isLoading=false, error=null for undefined modelId')

  // AC-5: Refetcht Schema bei modelId-Aenderung
  it.todo('should refetch schema when modelId changes')

  // AC-6: Verwirft veraltete Antwort bei modelId-Wechsel waehrend laufendem Fetch
  it.todo('should discard stale response when modelId changes during pending fetch')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-01 | `resolveModel` | Function | Wird nicht direkt importiert, aber Consumer (Slices 3+4) rufen `resolveModel` auf um die `modelId` zu bestimmen, die an `useModelSchema` uebergeben wird |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `useModelSchema` | Hook | slice-03 (Prompt Panel), slice-04 (Canvas Popovers) | `useModelSchema(modelId: string \| undefined) => { schema: { properties: Record<string, unknown> } \| null, isLoading: boolean, error: string \| null }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/hooks/use-model-schema.ts` — Neuer React Hook: exportiert `useModelSchema()` als named export
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice erstellt NUR den Hook, KEINE UI-Integration
- Keine Aenderungen an `ParameterPanel` oder anderen Components
- Keine Aenderungen an `prompt-area.tsx` oder Canvas Popovers
- Kein neuer Server Action oder API Endpoint (nutzt bestehenden `getModelSchema`)

**Technische Constraints:**
- `"use client"` Direktive erforderlich (React Hook mit useState/useEffect)
- Server Action `getModelSchema` aus `@/app/actions/models` importieren
- Race-Condition-Schutz bei modelId-Wechsel (Cleanup-Funktion in useEffect oder AbortController-Pattern)
- Named export (`export function useModelSchema`), kein default export
- Return-Type: `{ schema: { properties: Record<string, unknown> } | null, isLoading: boolean, error: string | null }`

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-15-aspect-ratio-controls/architecture.md` → Section "Architecture Layers" (useModelSchema Hook)
- Architecture: `specs/phase-7/2026-03-15-aspect-ratio-controls/architecture.md` → Section "Error Handling Strategy"
- Architecture: `specs/phase-7/2026-03-15-aspect-ratio-controls/architecture.md` → Section "API Design > Endpoints" (getModelSchema Action)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `app/actions/models.ts` → `getModelSchema` | Import und Aufruf — NICHT neu implementieren |
