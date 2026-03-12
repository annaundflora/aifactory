# Slice 17: Migration bestehender sourceImageUrl zu generation_references

> **Slice 17 von 17** fuer `Multi-Image Referencing`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-17-migration-cleanup` |
| **Test** | `pnpm test lib/db/migrations/__tests__/migrate-source-images` |
| **E2E** | `false` |
| **Dependencies** | `["slice-02-reference-queries", "slice-13-generation-integration", "slice-15-provenance-lightbox"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` (Next.js 16.1.6 + Drizzle ORM 0.45 + Vitest) |
| **Test Command** | `pnpm test lib/db/migrations/__tests__/migrate-source-images` |
| **Integration Command** | N/A |
| **Acceptance Command** | `pnpm test lib/db/migrations/__tests__/migrate-source-images` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | N/A |
| **Mocking Strategy** | `mock_external` (Drizzle `db` Instanz mocken, kein echter DB-Zugriff in Unit-Tests) |

---

## Ziel

Ein ausfuehrbares Migrations-Script erstellen, das alle bestehenden `generations`-Eintraege mit gesetzter `sourceImageUrl` in das neue `generation_references`-System ueberfuehrt. Jede migrierte `sourceImageUrl` wird als Referenz-Bild mit Rolle "content" und Strength "moderate" angelegt, sodass die Lightbox-Provenance (Slice 15) auch fuer alte img2img-Generierungen korrekte Referenzen anzeigt.

---

## Acceptance Criteria

1) GIVEN 3 Generierungen in der DB: gen-A mit `sourceImageUrl = "https://r2.example/a.png"`, gen-B mit `sourceImageUrl = "https://r2.example/b.png"`, gen-C mit `sourceImageUrl = null`
   WHEN das Migrations-Script ausgefuehrt wird
   THEN existieren genau 2 neue `reference_images`-Records (fuer gen-A und gen-B) und 0 Records fuer gen-C

2) GIVEN eine Generation gen-A mit `sourceImageUrl = "https://r2.example/a.png"` und `projectId = "proj-1"`
   WHEN das Migrations-Script diese Generation verarbeitet
   THEN existiert ein `reference_images`-Record mit `imageUrl = "https://r2.example/a.png"`, `projectId = "proj-1"`, `sourceType = "gallery"`, `sourceGenerationId = gen-A.id`

3) GIVEN eine Generation gen-A wurde migriert und hat einen neuen `reference_images`-Record mit `id = "ref-X"`
   WHEN die zugehoerigen `generation_references` geprueft werden
   THEN existiert ein Record mit `generationId = gen-A.id`, `referenceImageId = "ref-X"`, `role = "content"`, `strength = "moderate"`, `slotPosition = 1`

4) GIVEN das Migrations-Script wird zweimal hintereinander ausgefuehrt
   WHEN es beim zweiten Lauf die DB prueft
   THEN werden keine Duplikate erstellt — Generierungen die bereits `generation_references`-Records haben, werden uebersprungen

5) GIVEN das Migrations-Script laeuft erfolgreich
   WHEN die `generations`-Tabelle inspiziert wird
   THEN ist die Spalte `sourceImageUrl` unveraendert (deprecated, NICHT geloescht) — bestehende Werte bleiben erhalten

6) GIVEN eine migrierte Generation gen-A wird in der Lightbox geoeffnet
   WHEN die ProvenanceRow (Slice 15) die Referenzen laedt
   THEN zeigt sie ein Thumbnail mit `@1`, Rolle "Content", Strength "Moderate" — identisch zu neuen Multi-Reference-Generierungen

7) GIVEN das Migrations-Script verarbeitet 100 Generierungen mit `sourceImageUrl`
   WHEN es ausgefuehrt wird
   THEN werden die Inserts in Batches ausgefuehrt (nicht 100 einzelne INSERT-Statements) und das Script gibt eine Zusammenfassung aus: `"Migrated: {N} generations, Skipped: {M} (already migrated), Errors: {E}"`

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/db/migrations/__tests__/migrate-source-images.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('migrateSourceImages', () => {
  // AC-1: Nur Generierungen mit sourceImageUrl migrieren
  it.todo('should create reference_images records only for generations with non-null sourceImageUrl')

  // AC-2: reference_images Record mit korrekten Feldern
  it.todo('should create reference_images with correct imageUrl, projectId, sourceType gallery, and sourceGenerationId')

  // AC-3: generation_references Record mit role content, strength moderate, slotPosition 1
  it.todo('should create generation_references with role content, strength moderate, and slotPosition 1')

  // AC-4: Idempotenz — keine Duplikate bei erneutem Lauf
  it.todo('should skip generations that already have generation_references records')

  // AC-5: sourceImageUrl Spalte bleibt unveraendert
  it.todo('should not modify or delete the sourceImageUrl column values')

  // AC-6: Migrierte Referenz in ProvenanceRow-kompatiblem Format
  it.todo('should produce generation_references records that ProvenanceRow can render with @1 label, role Content, and strength Moderate')

  // AC-7: Batch-Verarbeitung und Zusammenfassung
  it.todo('should process inserts in batches and return migration summary with migrated, skipped, and error counts')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-02-reference-queries | `createReferenceImage` | Async Function | `(input: { projectId, imageUrl, sourceType, sourceGenerationId? }) => Promise<ReferenceImage>` |
| slice-02-reference-queries | `createGenerationReferences` | Async Function | `(refs: { generationId, referenceImageId, role, strength, slotPosition }[]) => Promise<GenerationReference[]>` |
| slice-02-reference-queries | `getGenerationReferences` | Async Function | `(generationId: string) => Promise<GenerationReference[]>` — fuer Idempotenz-Check |
| slice-13-generation-integration | `generation_references` Records-Struktur | DB-Schema | Schema existiert und akzeptiert role="content", strength="moderate" |
| slice-15-provenance-lightbox | `ProvenanceRow` | React Component | Zeigt migrierte Referenzen korrekt an (keine Aenderung noetig, verifiziert via AC-6) |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `migrateSourceImages` | Async Function | Manueller Aufruf (CLI/Script) | `() => Promise<{ migrated: number, skipped: number, errors: number }>` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/db/migrations/migrate-source-images.ts` -- Neues Migrations-Script: Liest alle Generierungen mit sourceImageUrl, erstellt reference_images + generation_references Records, Idempotenz-Guard, Batch-Processing, Summary-Output
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Loeschen oder Aendern der `sourceImageUrl`-Spalte in `generations` — Spalte bleibt deprecated erhalten
- KEIN R2-Upload — die existierenden `sourceImageUrl`-URLs werden direkt als `imageUrl` in `reference_images` uebernommen
- KEINE Schema-Aenderungen — alle Tabellen existieren bereits (Slice 01, 02)
- KEINE UI-Aenderungen — ProvenanceRow (Slice 15) zeigt migrierte Daten automatisch korrekt an
- KEIN automatischer Start beim App-Boot — Script wird manuell/einmalig ausgefuehrt

**Technische Constraints:**
- Nutze Drizzle ORM fuer alle DB-Operationen (kein raw SQL)
- Idempotenz: Vor Insert pruefen ob `generation_references` fuer die Generation bereits existieren (via `getGenerationReferences`)
- Batch-Groesse: Verarbeite Generierungen in Chunks (z.B. 50er Batches), nicht alle auf einmal
- `sourceType` fuer migrierte Eintraege: `"gallery"` (da sourceImageUrl aus bestehenden Generierungen stammt)
- Default-Werte: `role = "content"`, `strength = "moderate"`, `slotPosition = 1` (Single-Image Backwards-Kompatibilitaet)
- `sourceGenerationId` der reference_images zeigt auf die Generation-ID der Quelle (Self-Reference: das ist die Generation die migriert wird)
- Script exportiert eine aufrufbare Funktion `migrateSourceImages()` und kann optional via `tsx lib/db/migrations/migrate-source-images.ts` direkt ausgefuehrt werden

**Referenzen:**
- Architecture: `architecture.md` --> Section "Constraints & Integrations" (Backwards compatibility, Zeile 329)
- Architecture: `architecture.md` --> Section "Risks & Mitigation" (Migration risk, Zeile 390)
- Architecture: `architecture.md` --> Section "Database Schema" (sourceImageUrl deprecated, Zeile 97)
- Discovery: `discovery.md` --> Section "Data > Generations Tabelle (AENDERUNG)" (Zeilen 309-313)
