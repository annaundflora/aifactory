# Slice 04: Model Schema Service — supportsImg2Img Helper

> **Slice 4 von 6** für `Multi-Mode Generation (img2img + Upscale)`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-04-model-schema-service` |
| **Test** | `pnpm test lib/services/__tests__/model-schema-service.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/services/__tests__/model-schema-service.test.ts` |
| **Integration Command** | `pnpm test lib/services/__tests__/` |
| **Acceptance Command** | — |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (fetch via vi.mock oder vi.stubGlobal, kein echter Replicate-Aufruf) |

---

## Ziel

`ModelSchemaService` wird um die Methode `supportsImg2Img(modelId)` ergänzt. Sie prüft, ob das gecachte Schema des Modells einen der Parameter `image`, `image_prompt` oder `init_image` enthält, und gibt `true` oder `false` zurück. Der bestehende In-Memory-Cache von `getSchema()` wird dabei zwingend genutzt — bei einem gecachten Modell darf kein zweiter Fetch-Aufruf stattfinden.

---

## Acceptance Criteria

1) GIVEN ein Modell, dessen Schema eine Property namens `image` enthält
   WHEN `supportsImg2Img(modelId)` aufgerufen wird
   THEN gibt die Methode `true` zurück

2) GIVEN ein Modell, dessen Schema eine Property namens `image_prompt` enthält (und kein `image`)
   WHEN `supportsImg2Img(modelId)` aufgerufen wird
   THEN gibt die Methode `true` zurück

3) GIVEN ein Modell, dessen Schema eine Property namens `init_image` enthält (und weder `image` noch `image_prompt`)
   WHEN `supportsImg2Img(modelId)` aufgerufen wird
   THEN gibt die Methode `true` zurück

4) GIVEN ein Modell, dessen Schema keinen der Parameter `image`, `image_prompt` oder `init_image` enthält
   WHEN `supportsImg2Img(modelId)` aufgerufen wird
   THEN gibt die Methode `false` zurück

5) GIVEN ein Modell, das bereits via `getSchema()` gecacht wurde
   WHEN `supportsImg2Img(modelId)` aufgerufen wird
   THEN wird `fetch` genau 0 Mal aufgerufen (kein zweiter API-Call; Schema kommt aus dem Cache)

6) GIVEN ein Modell, das noch nicht gecacht wurde
   WHEN `supportsImg2Img(modelId)` aufgerufen wird
   THEN wird `fetch` genau 1 Mal aufgerufen, und danach ist das Schema im Cache (ein weiterer Aufruf von `supportsImg2Img` löst keinen weiteren Fetch aus)

7) GIVEN ein unbekanntes Modell (nicht in `MODELS` aus `lib/models.ts`)
   WHEN `supportsImg2Img(modelId)` aufgerufen wird
   THEN wirft die Methode einen Error mit der Meldung `"Unbekanntes Modell"`

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Der Test-Writer implementiert Assertions via `vi.stubGlobal('fetch', ...)` oder `vi.mock`. `clearCache()` vor jedem Test aufrufen, um Isolation sicherzustellen.

### Test-Datei: `lib/services/__tests__/model-schema-service.test.ts`

<test_spec>
```typescript
// AC-1: Modell mit 'image' Parameter wird als img2img-kompatibel erkannt
it.todo('should return true when schema contains image parameter')

// AC-2: Modell mit 'image_prompt' Parameter wird als img2img-kompatibel erkannt
it.todo('should return true when schema contains image_prompt parameter')

// AC-3: Modell mit 'init_image' Parameter wird als img2img-kompatibel erkannt
it.todo('should return true when schema contains init_image parameter')

// AC-4: Modell ohne keinen der drei Parameter gibt false zurueck
it.todo('should return false when schema contains none of image, image_prompt, init_image')

// AC-5: Kein zweiter Fetch wenn Schema bereits gecacht
it.todo('should not call fetch again when schema is already cached')

// AC-6: Erster Aufruf fetcht; zweiter Aufruf aus Cache
it.todo('should call fetch exactly once and cache the result for subsequent calls')

// AC-7: Unbekanntes Modell wirft Error
it.todo('should throw "Unbekanntes Modell" for an unknown modelId')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| — | — | — | Keine Slice-Abhängigkeiten; nutzt nur internen Cache und `lib/models.ts` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ModelSchemaService.supportsImg2Img` | Function | slice-05 (PromptArea Client), generation-service | `(modelId: string) => Promise<boolean>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/services/model-schema-service.ts` — neue Methode `supportsImg2Img(modelId: string): Promise<boolean>` hinzufügen; prüft Schema-Properties auf `image`, `image_prompt`, `init_image`; nutzt bestehenden `schemaCache` via `getSchema()`
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt `lib/services/__tests__/model-schema-service.test.ts` basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Nur `supportsImg2Img` wird hinzugefügt — `getSchema()` und `clearCache()` bleiben unverändert
- Keine Logik zum automatischen Model-Switch (das ist Aufgabe der PromptArea-Komponente in Slice 05)
- Kein Caching des `boolean`-Ergebnisses — die Methode ruft intern `getSchema()` auf und wertet das Schema aus; der Schema-Cache reicht aus
- Kein neuer Env-Var oder Konfigurationsparameter

**Technische Constraints:**
- `supportsImg2Img` muss `getSchema()` intern aufrufen (nicht direkt auf `schemaCache` zugreifen), um Cache-Logik nicht zu duplizieren
- Die drei zu prüfenden Parameter-Namen sind exakt: `"image"`, `"image_prompt"`, `"init_image"` — kein Wildcard-Matching
- Der Rückgabetyp ist `Promise<boolean>` — `getSchema()` ist async

**Referenzen:**
- Bestehende Service-Implementierung: `lib/services/model-schema-service.ts` (alle 54 Zeilen)
- Fachliche Anforderung (drei Parameter-Namen): `architecture.md` → Section "Server Logic → Services & Processing" (Zeile `ModelSchemaService.supportsImg2Img`)
- Model-Auto-Switch Kontext: `architecture.md` → Section "Server Logic → Model Auto-Switch (Client-Side)"
- Open Question 1 (Cache-Entscheidung): `architecture.md` → Section "Open Questions" (Frage #1)
