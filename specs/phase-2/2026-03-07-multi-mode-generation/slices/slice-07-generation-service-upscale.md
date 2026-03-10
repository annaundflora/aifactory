# Slice 07: Generation Service — upscale() Methode

> **Slice 7 von 9** für `Multi-Mode Generation (img2img + Upscale)`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-07-generation-service-upscale` |
| **Test** | `pnpm test lib/services/__tests__/generation-service.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-db-queries", "slice-05-models-upscale-constant"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/services/__tests__/generation-service.test.ts` |
| **Integration Command** | `pnpm test lib/services/__tests__/` |
| **Acceptance Command** | — |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (ReplicateClient, StorageService und DB-Queries via vi.mock) |

---

## Ziel

`GenerationService` erhält eine neue öffentliche Methode `upscale()`, die einen einzelnen Upscale-Job mit dem fixen Modell `UPSCALE_MODEL` ausführt. Die Methode erstellt genau einen `Generation`-Record mit `generationMode: "upscale"` und leitet die Verarbeitung fire-and-forget weiter — analog zu `generate()`. Prompt wird server-seitig aus `scale` und optionalem `sourceGenerationId` zusammengesetzt.

---

## Acceptance Criteria

1) GIVEN `upscale({ projectId, sourceImageUrl, scale: 2 })` ohne `sourceGenerationId`
   WHEN die Methode aufgerufen wird
   THEN ruft `ReplicateClient.run` mit dem Modell-String `"nightmareai/real-esrgan"` auf, und der erstellte DB-Record hat `prompt: "Upscale 2x"`

2) GIVEN `upscale({ projectId, sourceImageUrl, scale: 4 })` ohne `sourceGenerationId`
   WHEN die Methode aufgerufen wird
   THEN hat der erstellte DB-Record `prompt: "Upscale 4x"`

3) GIVEN `upscale({ projectId, sourceImageUrl, scale: 2, sourceGenerationId })` und die Quell-Generation hat `prompt: "a red fox"`
   WHEN die Methode aufgerufen wird
   THEN hat der erstellte DB-Record `prompt: "a red fox (Upscale 2x)"`

4) GIVEN ein valider `upscale()`-Aufruf mit beliebigen Parametern
   WHEN die Methode aufgerufen wird
   THEN enthält der zurückgegebene Record genau `generationMode: "upscale"`, `sourceImageUrl` mit dem übergebenen Wert und `sourceGenerationId` (null oder übergebener Wert)

5) GIVEN ein valider `upscale()`-Aufruf
   WHEN die Methode aufgerufen wird
   THEN gibt sie genau 1 `Generation`-Objekt mit `status: "pending"` zurück (kein Array)

6) GIVEN `ReplicateClient.run` gibt ein `output`-Stream-Objekt zurück
   WHEN `upscale()` die Verarbeitung fire-and-forget startet
   THEN wird `ReplicateClient.run` mit `{ image: sourceImageUrl, scale }` als Input aufgerufen (kein `prompt`-Feld im Replicate-Input)

7) GIVEN `ReplicateClient.run` wirft einen Fehler während der Verarbeitung
   WHEN der fire-and-forget Prozess den Fehler erhält
   THEN wird `updateGeneration` mit `status: "failed"` aufgerufen und die Methode `upscale()` selbst wirft keinen Fehler (Fire-and-forget bleibt isoliert)

8) GIVEN `upscale()` wird mit `scale: 3` (ungültigem Wert) aufgerufen
   WHEN die Methode aufgerufen wird
   THEN wirft sie einen Error (keine DB-Record-Erstellung, kein Replicate-Call)

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Vi.mock für `ReplicateClient`, `StorageService`, `createGeneration`, `updateGeneration` und `getGeneration` — bestehende Mock-Patterns in `generation-service.test.ts` übernehmen.

### Test-Datei: `lib/services/__tests__/generation-service.test.ts`

<test_spec>
```typescript
// AC-1: Replicate-Call mit UPSCALE_MODEL, Prompt "Upscale 2x" ohne sourceGenerationId
it.todo('should call ReplicateClient.run with nightmareai/real-esrgan and prompt "Upscale 2x" when scale is 2')

// AC-2: Prompt "Upscale 4x" wenn scale 4
it.todo('should set prompt to "Upscale 4x" when scale is 4')

// AC-3: Prompt aus sourceGeneration zusammengesetzt mit "(Upscale 2x)"
it.todo('should compose prompt from source generation prompt when sourceGenerationId is provided')

// AC-4: generationMode, sourceImageUrl und sourceGenerationId korrekt im Record
it.todo('should create record with generationMode upscale, sourceImageUrl and sourceGenerationId')

// AC-5: Rueckgabe genau 1 pending Generation (kein Array)
it.todo('should return exactly 1 pending Generation object (not an array)')

// AC-6: Replicate-Input enthaelt nur image und scale, kein prompt
it.todo('should call ReplicateClient.run with { image, scale } input without prompt field')

// AC-7: Fehler in fire-and-forget markiert Generation als failed ohne upscale() zu werfen
it.todo('should mark generation as failed when ReplicateClient throws, without propagating the error')

// AC-8: Ungültiger scale-Wert wirft Fehler
it.todo('should throw an error when scale is not 2 or 4')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-02-db-queries` | `createGeneration` | Function | Akzeptiert `generationMode`, `sourceImageUrl`, `sourceGenerationId` als optionale Felder |
| `slice-02-db-queries` | `getGeneration` | Function | Liefert `Generation` mit `prompt`-Feld (für Prompt-Komposition bei Lightbox-Upscale) |
| `slice-05-models-upscale-constant` | `UPSCALE_MODEL` | `string` Konstante | Wert ist `"nightmareai/real-esrgan"` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `GenerationService.upscale` | Function | Server Action `upscaleImage` (Slice 08) | `(input: UpscaleInput) => Promise<Generation>` |
| `UpscaleInput` | TypeScript Type | Slice 08 | `{ projectId: string, sourceImageUrl: string, scale: 2 \| 4, sourceGenerationId?: string }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/services/generation-service.ts` — neue `upscale()`-Methode hinzufügen; `GenerationService`-Export um `upscale` erweitern
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erweitert `lib/services/__tests__/generation-service.test.ts` basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Nur `upscale()` wird neu hinzugefügt — `generate()`, `retry()` und `buildReplicateInput()` bleiben unberührt
- Keine Änderungen an der Server Action `upscaleImage` (das ist Scope von Slice 08)
- Kein neuer `processUpscale`-Helper erforderlich — bestehender `processGeneration` kann genutzt oder ein dedizierter Pfad angelegt werden, solange der Replicate-Input-Aufbau `{ image, scale }` (kein prompt) korrekt ist

**Technische Constraints:**
- `UPSCALE_MODEL` aus `lib/models.ts` importieren — kein Hardcoding des Model-Strings in der Service-Datei
- `getGeneration` aufrufen (existiert bereits) um `sourceGeneration.prompt` zu laden, wenn `sourceGenerationId` übergeben wird
- Fire-and-forget-Pattern wie in `generate()`: asynchrone Verarbeitung starten, nicht auf Ergebnis warten, Fehler intern behandeln
- Scale-Validierung: nur `2` und `4` erlaubt, sonst Error werfen (Validation Rules aus architecture.md)
- Replicate-Input für Upscale: `{ image: sourceImageUrl, scale }` — kein `prompt`-Feld (siehe architecture.md → Section "Server Logic → buildReplicateInput Enhancement")

**Referenzen:**
- Upscale Business Logic Flow: `architecture.md` → Section "Server Logic → Business Logic Flow → Upscale"
- Prompt-Komposition: `architecture.md` → Section "Server Logic → Upscale Prompt Composition"
- Replicate-Input-Aufbau: `architecture.md` → Section "Server Logic → buildReplicateInput Enhancement"
- Validierungsregeln für `scale`: `architecture.md` → Section "Server Logic → Validation Rules"
