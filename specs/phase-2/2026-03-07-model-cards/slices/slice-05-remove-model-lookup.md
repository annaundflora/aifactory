# Slice 5: Static Model Lookup aus Lightbox + Prompt-Service entfernen

> **Slice 5 von 14** fuer `Model Cards & Multi-Model Selection`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-05-remove-model-lookup` |
| **Test** | `pnpm test lib/utils/__tests__/model-display-name.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-03-server-action-collection"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/utils/__tests__/model-display-name.test.ts` |
| **Integration Command** | `pnpm build` |
| **Acceptance Command** | `pnpm build` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Shared Helper `modelIdToDisplayName()` erstellen, der aus einer Model-ID (z.B. `"black-forest-labs/flux-1.1-pro"`) einen lesbaren Display-Namen ableitet (`"Flux 1.1 Pro"`). Diesen Helper in `lightbox-modal.tsx` und `prompt-service.ts` verwenden, um die letzten `getModelById`-Imports aus `lib/models` zu entfernen.

---

## Acceptance Criteria

1) GIVEN die Funktion `modelIdToDisplayName` importiert aus `lib/utils/model-display-name.ts`
   WHEN `modelIdToDisplayName("black-forest-labs/flux-1.1-pro")` aufgerufen wird
   THEN gibt sie `"Flux 1.1 Pro"` zurueck

2) GIVEN die Funktion `modelIdToDisplayName`
   WHEN `modelIdToDisplayName("stability-ai/stable-diffusion-xl-base-1.0")` aufgerufen wird
   THEN gibt sie `"Stable Diffusion Xl Base 1.0"` zurueck
   (Split auf `/`, Name-Teil nehmen, Bindestriche durch Leerzeichen, Title-Case)

3) GIVEN die Funktion `modelIdToDisplayName`
   WHEN `modelIdToDisplayName("recraft-ai/recraft-v4")` aufgerufen wird
   THEN gibt sie `"Recraft V4"` zurueck

4) GIVEN die Funktion `modelIdToDisplayName`
   WHEN `modelIdToDisplayName("single-segment")` aufgerufen wird (kein `/` vorhanden)
   THEN gibt sie `"Single Segment"` zurueck (Fallback: gesamten String als Name behandeln)

5) GIVEN die Funktion `modelIdToDisplayName`
   WHEN `modelIdToDisplayName("")` aufgerufen wird (leerer String)
   THEN gibt sie `""` zurueck

6) GIVEN `components/lightbox/lightbox-modal.tsx` nach dem Refactoring
   WHEN die Datei inspiziert wird
   THEN existiert KEIN Import von `@/lib/models`
   AND der Display-Name wird ueber `modelIdToDisplayName(generation.modelId)` abgeleitet

7) GIVEN `lib/services/prompt-service.ts` nach dem Refactoring
   WHEN die Datei inspiziert wird
   THEN existiert KEIN Import von `@/lib/models`
   AND der Display-Name wird ueber `modelIdToDisplayName(modelId)` abgeleitet

8) GIVEN alle Aenderungen aus Slice 05
   WHEN `pnpm build` ausgefuehrt wird
   THEN kompiliert der Build fehlerfrei

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/utils/__tests__/model-display-name.test.ts`

<test_spec>
```typescript
// AC-1: Standard Model-ID mit owner/name
it.todo('should convert "black-forest-labs/flux-1.1-pro" to "Flux 1.1 Pro"')

// AC-2: Langer Model-Name mit mehreren Segmenten
it.todo('should convert "stability-ai/stable-diffusion-xl-base-1.0" to "Stable Diffusion Xl Base 1.0"')

// AC-3: Kurzer Model-Name
it.todo('should convert "recraft-ai/recraft-v4" to "Recraft V4"')

// AC-4: Fallback bei fehlender Slash-Trennung
it.todo('should handle model ID without slash by treating entire string as name')

// AC-5: Leerer String
it.todo('should return empty string for empty input')

// AC-6: Kein Import von lib/models in lightbox-modal.tsx
it.todo('should not import from lib/models in lightbox-modal.tsx')

// AC-7: Kein Import von lib/models in prompt-service.ts
it.todo('should not import from lib/models in prompt-service.ts')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-03` | `lib/models.ts` geloescht | Datei-Loesch. | Datei existiert nicht mehr; `getModelById` nicht mehr verfuegbar |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `modelIdToDisplayName` | Pure Function | `slice-13` (Gallery Model Badge) | `modelIdToDisplayName(modelId: string): string` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/utils/model-display-name.ts` -- Helper-Funktion `modelIdToDisplayName(modelId: string): string`
- [ ] `components/lightbox/lightbox-modal.tsx` -- Import `getModelById` entfernen, durch `modelIdToDisplayName` ersetzen
- [ ] `lib/services/prompt-service.ts` -- Import `getModelById` entfernen, durch `modelIdToDisplayName` ersetzen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an `generation-service.ts` oder `model-schema-service.ts` (wurden in Slice 04 refactored)
- KEINE Aenderungen an `prompt-area.tsx` (kommt in Slice 10)
- KEINE Aenderungen an `app/actions/generations.ts` (kommt in Slice 12)
- KEINE Aenderungen an Test-Dateien die `getModelById` mocken (z.B. `lightbox-modal.test.tsx`, `variation-flow.test.tsx`) -- Test-Writer passt diese an

**Technische Constraints:**
- `modelIdToDisplayName` ist eine reine Funktion (keine Side Effects, kein async, kein Cache)
- Algorithmus: Split auf `/` -> letztes Segment nehmen -> Bindestriche durch Leerzeichen ersetzen -> jedes Wort Title-Case (erster Buchstabe gross)
- Fallback: Wenn kein `/` vorhanden, gesamten String als Name-Teil verwenden
- In `lightbox-modal.tsx`: `getModelById(generation.modelId)?.displayName ?? generation.modelId` ersetzen durch `modelIdToDisplayName(generation.modelId)`
- In `prompt-service.ts`: `getModelById(modelId)?.displayName ?? modelId` ersetzen durch `modelIdToDisplayName(modelId)`

**Referenzen:**
- Architecture: `specs/phase-2/2026-03-07-model-cards/architecture.md` -> Section "Migration Map" (lightbox-modal.tsx, prompt-service.ts Eintraege)
- Architecture: `specs/phase-2/2026-03-07-model-cards/architecture.md` -> Section "Technology Decisions" (Model display name from modelId split)
- Slice 03: `specs/phase-2/2026-03-07-model-cards/slices/slice-03-server-action-collection.md` -> Loeschung von `lib/models.ts`
