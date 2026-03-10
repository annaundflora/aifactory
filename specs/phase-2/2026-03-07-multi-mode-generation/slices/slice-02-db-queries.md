# Slice 02: DB Queries — createGeneration für neue Felder

> **Slice 2 von 6** für `Multi-Mode Generation (img2img + Upscale)`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-02-db-queries` |
| **Test** | `pnpm test lib/db/__tests__/queries.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-db-schema"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/db/__tests__/queries.test.ts` |
| **Integration Command** | `pnpm test lib/db/__tests__/` |
| **Acceptance Command** | — |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (Drizzle-DB via vi.mock, keine echte DB-Verbindung) |

---

## Ziel

Die `createGeneration`-Query-Funktion wird um die drei neuen Felder `generationMode`, `sourceImageUrl` und `sourceGenerationId` erweitert. Alle neuen Parameter sind optional mit Defaults, sodass bestehende Aufrufer ohne Anpassung weiterhin funktionieren. Dieser Slice liefert den Query-Layer, den der Generation-Service (Slice 03) direkt nutzt.

---

## Acceptance Criteria

1) GIVEN ein Aufruf von `createGeneration` ohne die neuen Felder
   WHEN der INSERT ausgeführt wird
   THEN enthält der zurückgegebene `Generation`-Record `generationMode: "txt2img"`, `sourceImageUrl: null` und `sourceGenerationId: null`

2) GIVEN ein Aufruf von `createGeneration` mit `generationMode: "img2img"` und einer validen `sourceImageUrl`
   WHEN der INSERT ausgeführt wird
   THEN enthält der zurückgegebene Record `generationMode: "img2img"` und `sourceImageUrl` mit dem übergebenen Wert

3) GIVEN ein Aufruf von `createGeneration` mit `generationMode: "upscale"`, `sourceImageUrl` und `sourceGenerationId` (UUID)
   WHEN der INSERT ausgeführt wird
   THEN enthält der zurückgegebene Record alle drei Felder mit den übergebenen Werten

4) GIVEN ein Aufruf von `createGeneration` mit `generationMode: "img2img"` ohne `sourceGenerationId`
   WHEN der INSERT ausgeführt wird
   THEN ist `sourceGenerationId` im zurückgegebenen Record `null`

5) GIVEN die erweiterte `createGeneration`-Funktion
   WHEN TypeScript die Input-Typen prüft
   THEN sind `generationMode`, `sourceImageUrl` und `sourceGenerationId` alle als optional typisiert (`?`); ein Aufruf mit nur den bisherigen Pflichtfeldern (`projectId`, `prompt`, `modelId`) kompiliert ohne Fehler

6) GIVEN ein bestehender Test für `createGeneration` ohne neue Felder (bisheriges Interface)
   WHEN alle Tests der Datei ausgeführt werden
   THEN bleiben bestehende Tests für `createGeneration`, `getGeneration`, `updateGeneration`, `deleteGeneration` grün (kein Breaking Change)

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Der Test-Writer implementiert die Assertions via `vi.mock` für Drizzle — bestehende Mocking-Patterns in `lib/db/__tests__/queries.test.ts` übernehmen.

### Test-Datei: `lib/db/__tests__/queries.test.ts`

<test_spec>
```typescript
// AC-1: Default-Werte wenn neue Felder weggelassen werden
it.todo('should insert generationMode txt2img, sourceImageUrl null, sourceGenerationId null when new fields are omitted')

// AC-2: img2img mit sourceImageUrl wird korrekt persistiert
it.todo('should insert generationMode img2img and sourceImageUrl when provided')

// AC-3: upscale mit sourceImageUrl und sourceGenerationId wird korrekt persistiert
it.todo('should insert all three new fields when generationMode is upscale with sourceGenerationId')

// AC-4: sourceGenerationId bleibt null wenn nicht uebergeben
it.todo('should insert sourceGenerationId as null when not provided for img2img')

// AC-5: Neue Felder sind optional — TypeScript kompiliert ohne neue Pflichtfelder
it.todo('should accept createGeneration call with only existing required fields (projectId, prompt, modelId)')

// AC-6: Kein Breaking Change — bestehende Tests bleiben gruen
it.todo('should not break existing createGeneration callers that omit new fields')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-db-schema` | `generations.generationMode`, `generations.sourceImageUrl`, `generations.sourceGenerationId` | Schema Columns | Spalten im Drizzle-Schema vorhanden und typisiert |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `createGeneration` | Function | `slice-03-generation-service` | `(input: CreateGenerationInput) => Promise<Generation>` |
| `CreateGenerationInput` | TypeScript Type | `slice-03-generation-service` | bestehende Felder + `generationMode?: string`, `sourceImageUrl?: string \| null`, `sourceGenerationId?: string \| null` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/db/queries.ts` — `createGeneration`-Input-Typ um optionale Felder `generationMode`, `sourceImageUrl`, `sourceGenerationId` erweitern; INSERT-Values entsprechend ergänzen mit Defaults (`'txt2img'`, `null`, `null`)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erweitert `lib/db/__tests__/queries.test.ts` basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Nur `createGeneration` wird geändert — `updateGeneration`, `getGeneration`, `getGenerations` bleiben unberührt
- Keine Validierungslogik (z.B. "img2img erfordert sourceImageUrl") — das ist Aufgabe des Service/Action-Layers (Slice 03/04)
- Kein neuer Query für "Generierungen nach Mode filtern" — das ist Scope von Slice 05 (Gallery)

**Technische Constraints:**
- Drizzle ORM: Neue Felder im `.values()`-Objekt mit Null-Coalescing (`?? null` / `?? 'txt2img'`) — kein roher SQL-INSERT
- `generationMode` Default: `'txt2img'` (entspricht DB-Column-Default aus Slice 01; trotzdem explizit im INSERT setzen für Klarheit)
- Breaking-Change-Verbot: Keine bestehenden Parameter entfernen oder als Pflichtfeld markieren

**Referenzen:**
- Spalten-Typen und Constraints: `architecture.md` → Section "Database Schema → Schema Changes (Drizzle)"
- Migration Map / betroffene Datei: `architecture.md` → Section "Migration Map" (Zeile `lib/db/queries.ts`)
- Bestehende `createGeneration`-Signatur: `lib/db/queries.ts` Zeilen 63–85
