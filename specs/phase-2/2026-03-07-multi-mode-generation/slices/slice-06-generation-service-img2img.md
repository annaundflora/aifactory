# Slice 06: Generation Service — img2img Erweiterung

> **Slice 6 von 6** für `Multi-Mode Generation (img2img + Upscale)`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-06-generation-service-img2img` |
| **Test** | `pnpm test lib/services/__tests__/generation-service.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-db-schema", "slice-02-db-queries", "slice-04-model-schema-service"]` |

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
| **Mocking Strategy** | `mock_external` (ReplicateClient, StorageService, createGeneration via vi.mock — kein echter API-Call) |

---

## Ziel

`GenerationService.generate()` und die interne Hilfsfunktion `buildReplicateInput()` werden um img2img-Unterstützung erweitert. Die Funktion nimmt die neuen optionalen Parameter `generationMode`, `sourceImageUrl` und `strength` entgegen, gibt sie an `createGeneration` weiter und baut den Replicate-Input so auf, dass das korrekte Bild-Parameter-Feld — ermittelt aus dem Modell-Schema via `ModelSchemaService` — gesetzt wird. Bestehende txt2img-Pfade bleiben unverändert.

---

## Acceptance Criteria

1) GIVEN ein `generate()`-Aufruf ohne `generationMode`, `sourceImageUrl` oder `strength`
   WHEN `createGeneration` innerhalb des Service aufgerufen wird
   THEN enthält der übergebene Input `generationMode: "txt2img"`, `sourceImageUrl: undefined | null`, `sourceGenerationId: undefined | null`

2) GIVEN ein `generate()`-Aufruf mit `generationMode: "img2img"`, einer validen `sourceImageUrl` und `strength: 0.6`
   WHEN `createGeneration` innerhalb des Service aufgerufen wird
   THEN enthält der übergebene Input `generationMode: "img2img"` und die übergebene `sourceImageUrl`

3) GIVEN ein `generate()`-Aufruf mit `generationMode: "img2img"`, `sourceImageUrl` und `strength: 0.6`, und das Modell-Schema enthält den Parameter `"image"`
   WHEN `buildReplicateInput` den Replicate-Input aufbaut
   THEN enthält der Input `image: <sourceImageUrl>` und `prompt_strength: 0.6`; `prompt` und `negative_prompt` bleiben erhalten

4) GIVEN ein `generate()`-Aufruf mit `generationMode: "img2img"`, `sourceImageUrl` und `strength: 0.4`, und das Modell-Schema enthält den Parameter `"image_prompt"` (nicht `"image"`)
   WHEN `buildReplicateInput` den Replicate-Input aufbaut
   THEN enthält der Input `image_prompt: <sourceImageUrl>` und `prompt_strength: 0.4` (nicht `image:`)

5) GIVEN ein `generate()`-Aufruf mit `generationMode: "img2img"`, `sourceImageUrl` und `strength: 0.85`, und das Modell-Schema enthält den Parameter `"init_image"` (weder `"image"` noch `"image_prompt"`)
   WHEN `buildReplicateInput` den Replicate-Input aufbaut
   THEN enthält der Input `init_image: <sourceImageUrl>` und `prompt_strength: 0.85`

6) GIVEN ein `generate()`-Aufruf mit `generationMode: "img2img"` aber ohne `sourceImageUrl`
   WHEN die Validierung in `generate()` greift
   THEN wirft die Funktion einen Error mit der Meldung `"Source-Image ist erforderlich fuer img2img"`

7) GIVEN ein `generate()`-Aufruf mit `generationMode: "img2img"`, `sourceImageUrl` und `strength: 1.5` (ausserhalb 0.0–1.0)
   WHEN die Validierung in `generate()` greift
   THEN wirft die Funktion einen Error mit der Meldung `"Strength muss zwischen 0 und 1 liegen"`

8) GIVEN ein `generate()`-Aufruf mit `generationMode: "txt2img"` (oder ohne `generationMode`) und einem Prompt
   WHEN `buildReplicateInput` den Replicate-Input aufbaut
   THEN enthält der Input weder `image` noch `image_prompt` noch `init_image` noch `prompt_strength`; bestehende txt2img-Tests bleiben grün

9) GIVEN ein `generate()`-Aufruf mit `generationMode: "img2img"`, `sourceImageUrl`, `strength: 0.6` und `count: 3`
   WHEN `createGeneration` intern aufgerufen wird
   THEN wird `createGeneration` genau 3 Mal mit identischer `generationMode` und `sourceImageUrl` aufgerufen

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Der Test-Writer implementiert Assertions via `vi.mock` — bestehende Mocking-Patterns in `lib/services/__tests__/generation-service.test.ts` übernehmen.

### Test-Datei: `lib/services/__tests__/generation-service.test.ts`

<test_spec>
```typescript
// AC-1: txt2img Default — createGeneration erhält generationMode: "txt2img"
it.todo('should pass generationMode txt2img to createGeneration when called without mode')

// AC-2: img2img — createGeneration erhält generationMode und sourceImageUrl
it.todo('should pass generationMode img2img and sourceImageUrl to createGeneration')

// AC-3: buildReplicateInput mit schema-Parameter "image"
it.todo('should set image and prompt_strength in replicate input when schema has image parameter')

// AC-4: buildReplicateInput mit schema-Parameter "image_prompt"
it.todo('should set image_prompt and prompt_strength when schema has image_prompt parameter')

// AC-5: buildReplicateInput mit schema-Parameter "init_image"
it.todo('should set init_image and prompt_strength when schema has init_image parameter')

// AC-6: Validierung — img2img ohne sourceImageUrl wirft Error
it.todo('should throw "Source-Image ist erforderlich fuer img2img" when sourceImageUrl is missing')

// AC-7: Validierung — strength ausserhalb 0.0-1.0 wirft Error
it.todo('should throw "Strength muss zwischen 0 und 1 liegen" when strength is out of range')

// AC-8: txt2img — kein Bild-Parameter im Replicate-Input
it.todo('should not include image, image_prompt, init_image or prompt_strength in txt2img replicate input')

// AC-9: count — createGeneration wird N Mal mit gleicher generationMode und sourceImageUrl aufgerufen
it.todo('should call createGeneration N times each with the same generationMode and sourceImageUrl')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-db-schema` | `Generation.generationMode`, `Generation.sourceImageUrl` | Schema Type | Felder auf `Generation`-Typ vorhanden |
| `slice-02-db-queries` | `createGeneration` | Function | Akzeptiert `generationMode?`, `sourceImageUrl?`, `sourceGenerationId?` |
| `slice-04-model-schema-service` | `ModelSchemaService.supportsImg2Img` / `getSchema` | Function | `getSchema(modelId)` liefert `SchemaProperties` mit Paramternamen |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `GenerationService.generate` | Function | `app/actions/generations.ts` (Slice-Aufrufer) | `(projectId, promptMotiv, promptStyle, negativePrompt?, modelId, params, count, generationMode?, sourceImageUrl?, strength?) => Promise<Generation[]>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/services/generation-service.ts` — `generate()` um optionale Parameter `generationMode`, `sourceImageUrl`, `strength` erweitern; Validierung für img2img-Pflichtfelder; `createGeneration`-Aufruf um neue Felder ergänzen; `buildReplicateInput` liest Schema via `ModelSchemaService` und setzt das korrekte Bild-Parameter-Feld (`image` / `image_prompt` / `init_image`) + `prompt_strength` nur im img2img-Modus
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt `lib/services/__tests__/generation-service.test.ts` basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Kein neues `upscale()`-Verfahren — das ist ausserhalb dieses Slice (separater Scope laut architecture.md)
- Keine Änderungen an `processGeneration`, `streamToPngBuffer` oder `retry` — nur `generate` und `buildReplicateInput` werden erweitert
- Keine UI-Änderungen, keine Server-Action-Anpassungen — nur der Service-Layer
- Kein neuer `uploadSourceImage`-Code — die `sourceImageUrl` wird bereits als fertige URL übergeben

**Technische Constraints:**
- `buildReplicateInput` wird async, da `ModelSchemaService.getSchema()` async ist
- Schema-Parameter-Priorität: `"image"` vor `"image_prompt"` vor `"init_image"` (Reihenfolge gemäss architecture.md → Constraints)
- Der In-Memory-Cache von `ModelSchemaService` muss genutzt werden — kein direkter `fetch`-Aufruf im Service
- Backwards-Kompatibilität: Alle bestehenden Aufrufer ohne neue Parameter kompilieren und laufen ohne Anpassung

**Referenzen:**
- Schema-getriebene Parametererkennung: `architecture.md` → Section "Server Logic → buildReplicateInput Enhancement"
- Validierungsregeln (Fehlermeldungen, Wertebereiche): `architecture.md` → Section "Server Logic → Validation Rules"
- Business Logic Flow img2img: `architecture.md` → Section "Server Logic → Business Logic Flow → img2img Generation"
- Bestehende Service-Implementierung: `lib/services/generation-service.ts` (Zeilen 109–127 für `buildReplicateInput`, Zeilen 138–194 für `generate`)
