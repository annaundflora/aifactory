# Slice 01: DB Schema — Neue Spalten in generations

> **Slice 1 von 6** für `Multi-Mode Generation (img2img + Upscale)`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-01-db-schema` |
| **Test** | `pnpm test lib/db/__tests__/schema-generations.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/db/__tests__/schema-generations.test.ts` |
| **Integration Command** | `pnpm test lib/db/__tests__/` |
| **Acceptance Command** | `npx drizzle-kit generate --dry-run` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` (reine Schema-Inspektion, keine DB-Verbindung nötig) |

---

## Ziel

Das Drizzle-Schema der `generations`-Tabelle wird um drei Spalten erweitert: `generationMode`, `sourceImageUrl` und `sourceGenerationId` (Self-Referenz-FK). Eine Migration wird via `drizzle-kit generate` erzeugt, sodass vorhandene Zeilen automatisch `generationMode = 'txt2img'` erhalten. Dieser Slice ist Voraussetzung für alle nachfolgenden Slices, die generationsmode-spezifische Daten schreiben oder lesen.

---

## Acceptance Criteria

1) GIVEN die `generations`-Tabellendefinition in `lib/db/schema.ts`
   WHEN die Spalte `generation_mode` inspiziert wird
   THEN ist sie `varchar(20)`, `NOT NULL`, mit Default `'txt2img'`

2) GIVEN die `generations`-Tabellendefinition
   WHEN die Spalte `source_image_url` inspiziert wird
   THEN ist sie `text`, NULLABLE (kein `notNull()`, kein Default)

3) GIVEN die `generations`-Tabellendefinition
   WHEN die Spalte `source_generation_id` inspiziert wird
   THEN ist sie `uuid`, NULLABLE, mit Foreign-Key auf `generations.id` (ON DELETE SET NULL)

4) GIVEN die erweiterte `generations`-Tabelle
   WHEN die Index-Definitionen inspiziert werden
   THEN existiert ein Index `generations_project_mode_idx` auf den Spalten `(project_id, generation_mode)` — in dieser Reihenfolge

5) GIVEN den `InferSelectModel`-Typ der erweiterten `generations`-Tabelle
   WHEN ein TypeScript-Modul diesen Typ importiert
   THEN enthält er `generationMode: string`, `sourceImageUrl: string | null` und `sourceGenerationId: string | null`

6) GIVEN die bestehenden Spalten und 4 Indexes der `generations`-Tabelle (Stand vor diesem Slice: `id`, `projectId`, `prompt`, `negativePrompt`, `modelId`, `modelParams`, `status`, `imageUrl`, `replicatePredictionId`, `errorMessage`, `width`, `height`, `seed`, `promptMotiv`, `promptStyle`, `isFavorite`, `createdAt`)
   WHEN die drei neuen Spalten hinzugefügt werden
   THEN bleiben alle bestehenden Spalten mit unverändertem Typ und allen 4 bestehenden Indexes erhalten; die Gesamtzahl der Indexes erhöht sich auf 5

7) GIVEN `npx drizzle-kit generate` wird ausgeführt
   WHEN der Befehl abgeschlossen ist
   THEN wird eine neue `.sql`-Datei unter `drizzle/migrations/` erzeugt, die `ALTER TABLE generations ADD COLUMN generation_mode` mit `DEFAULT 'txt2img'` enthält, und der Prozess endet mit Exit-Code 0

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Der Test-Writer implementiert die Assertions anhand des bestehenden Patterns in `lib/db/__tests__/schema-generations.test.ts` (getTableConfig + columnMap).

### Test-Datei: `lib/db/__tests__/schema-generations.test.ts`

<test_spec>
```typescript
// AC-1: generation_mode Spaltendefinition
it.todo('should define generation_mode as varchar(20), not null, default txt2img')

// AC-2: source_image_url Spaltendefinition
it.todo('should define source_image_url as text, nullable, no default')

// AC-3: source_generation_id Spaltendefinition und Self-Ref-FK
it.todo('should define source_generation_id as uuid, nullable, with FK to generations.id ON DELETE SET NULL')

// AC-4: Composite Index auf (project_id, generation_mode)
it.todo('should define generations_project_mode_idx on (project_id, generation_mode)')

// AC-5: InferSelectModel Typ enthält neue Properties
it.todo('should expose generationMode, sourceImageUrl, sourceGenerationId in inferred select type')

// AC-6: Bestehende Spalten und Indexes unveraendert
it.todo('should preserve all 17 existing columns and all 4 existing indexes; total index count is 5')

// AC-7: drizzle-kit generate erzeugt Migration ohne Fehler
it.todo('should verify migration file contains ADD COLUMN generation_mode with DEFAULT txt2img')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| — | — | — | Keine Abhängigkeiten |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `generations.generationMode` | Schema Column | slice-02, slice-03, slice-04, slice-05 | `varchar(20) NOT NULL DEFAULT 'txt2img'` |
| `generations.sourceImageUrl` | Schema Column | slice-02, slice-03, slice-04 | `text NULLABLE` |
| `generations.sourceGenerationId` | Schema Column | slice-04, slice-06 | `uuid NULLABLE FK→generations.id ON DELETE SET NULL` |
| `GenerationSelect` (InferSelectModel) | TypeScript Type | alle nachfolgenden Slices | `+ generationMode: string, sourceImageUrl: string \| null, sourceGenerationId: string \| null` |
| `drizzle/migrations/XXXX_add_generation_mode.sql` | Migration File | Deployment | `ALTER TABLE generations ADD COLUMN ...` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/db/schema.ts` — 3 neue Spalten (`generationMode`, `sourceImageUrl`, `sourceGenerationId`) + Self-Ref-FK + Composite-Index `generations_project_mode_idx`
- [ ] `drizzle/migrations/XXXX_add_generation_mode.sql` — auto-generiert via `npx drizzle-kit generate`; enthält `ADD COLUMN generation_mode VARCHAR(20) NOT NULL DEFAULT 'txt2img'`
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erweitert `lib/db/__tests__/schema-generations.test.ts` basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice ändert KEINE anderen Dateien (keine Queries, keine Actions, kein Service)
- `drizzle/migrations/` wird NICHT manuell bearbeitet — nur `drizzle-kit generate` erzeugt die SQL-Datei
- Kein Seeding oder Testdaten-Setup; Schema-Tests laufen ohne DB-Verbindung

**Technische Constraints:**
- Drizzle ORM `pgTable`-Syntax: Self-Ref-FK mit `references(() => generations.id, { onDelete: 'set null' })` — Drizzle unterstützt Forward-References via Arrow-Function
- `varchar(20)` für `generationMode` — ausreichend für `'txt2img'`, `'img2img'`, `'upscale'` und zukünftige Modi
- Composite-Index: `project_id` zuerst, `generation_mode` zweiter — entspricht der Abfragereihenfolge (Filter by project, dann by mode)

**Referenzen:**
- Schema-Details: `architecture.md` → Section "Database Schema → Schema Changes (Drizzle)"
- Index-Strategie: `architecture.md` → Section "Database Schema → Index Strategy"
- Constraints & Backwards-Compatibility: `architecture.md` → Section "Constraints & Integrations → Constraints" (Zeile: "Existing generations have no generationMode")
