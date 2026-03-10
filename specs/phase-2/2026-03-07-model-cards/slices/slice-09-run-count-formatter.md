# Slice 9: Run Count Formatter Utility

> **Slice 9 von 14** fuer `Model Cards & Multi-Model Selection`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-09-run-count-formatter` |
| **Test** | `pnpm test lib/utils/__tests__/format-run-count.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/utils/__tests__/format-run-count.test.ts` |
| **Integration Command** | `pnpm build` |
| **Acceptance Command** | `pnpm build` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Pure Utility-Funktion `formatRunCount(count: number): string` erstellen, die numerische Run-Counts menschenlesbar formatiert. Die Funktion wird in Slice 08 (Model Browser Drawer) verwendet, um `run_count` aus `CollectionModel` auf der `ModelCard` anzuzeigen.

---

## Acceptance Criteria

1) GIVEN `count = 0`
   WHEN `formatRunCount(0)` aufgerufen wird
   THEN gibt die Funktion den String `"0 runs"` zurueck

2) GIVEN `count = 999` (unterhalb der Tausend-Schwelle)
   WHEN `formatRunCount(999)` aufgerufen wird
   THEN gibt die Funktion den String `"999 runs"` zurueck

3) GIVEN `count = 1000` (exakt an der Tausend-Schwelle)
   WHEN `formatRunCount(1000)` aufgerufen wird
   THEN gibt die Funktion den String `"1K runs"` zurueck

4) GIVEN `count = 1500` (Tausender mit Dezimalstelle)
   WHEN `formatRunCount(1500)` aufgerufen wird
   THEN gibt die Funktion den String `"1.5K runs"` zurueck

5) GIVEN `count = 150000` (sechsstellig ohne signifikante Dezimalstelle)
   WHEN `formatRunCount(150000)` aufgerufen wird
   THEN gibt die Funktion den String `"150K runs"` zurueck

6) GIVEN `count = 1000000` (exakt an der Million-Schwelle)
   WHEN `formatRunCount(1000000)` aufgerufen wird
   THEN gibt die Funktion den String `"1M runs"` zurueck

7) GIVEN `count = 2300000` (Millionen mit Dezimalstelle)
   WHEN `formatRunCount(2300000)` aufgerufen wird
   THEN gibt die Funktion den String `"2.3M runs"` zurueck

8) GIVEN `count = 1000000000` (Milliarde)
   WHEN `formatRunCount(1000000000)` aufgerufen wird
   THEN gibt die Funktion den String `"1B runs"` zurueck

9) GIVEN ein gerundeter Wert der Null-Trailing-Dezimalen hat (z.B. `count = 2000000`)
   WHEN `formatRunCount(2000000)` aufgerufen wird
   THEN gibt die Funktion `"2M runs"` zurueck (NICHT `"2.0M runs"`)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/utils/__tests__/format-run-count.test.ts`

<test_spec>
```typescript
// AC-1: Null-Wert
it.todo('should return "0 runs" for count 0')

// AC-2: Unterhalb Tausend-Schwelle
it.todo('should return "999 runs" for count 999')

// AC-3: Exakt Tausend-Schwelle
it.todo('should return "1K runs" for count 1000')

// AC-4: Tausender mit Dezimalstelle
it.todo('should return "1.5K runs" for count 1500')

// AC-5: Sechsstelliger Wert ohne Dezimalstelle
it.todo('should return "150K runs" for count 150000')

// AC-6: Exakt Million-Schwelle
it.todo('should return "1M runs" for count 1000000')

// AC-7: Millionen mit Dezimalstelle
it.todo('should return "2.3M runs" for count 2300000')

// AC-8: Milliarde
it.todo('should return "1B runs" for count 1000000000')

// AC-9: Keine Trailing-Nullen in Dezimalstelle
it.todo('should return "2M runs" (not "2.0M runs") for count 2000000')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

Keine Abhaengigkeiten.

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `formatRunCount` | Pure Function | `slice-08` (Model Browser Drawer) | `formatRunCount(count: number): string` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/utils/format-run-count.ts` -- Pure Funktion `formatRunCount(count: number): string` mit Schwellenwerten 1K / 1M / 1B und einer Dezimalstelle (ohne Trailing-Nullen)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- NUR die Funktion `formatRunCount` -- kein weiterer Export, kein Formatter fuer andere Einheiten
- KEINE Internationalisierung (`Intl.NumberFormat` o.ae.) -- Ausgabe ist immer englisch (`K`, `M`, `B`)
- KEINE Behandlung negativer Zahlen oder Nicht-Integer-Werte (ausserhalb des Scopes)
- KEIN UI-Rendering -- reine Logik-Datei, kein React-Import

**Technische Constraints:**
- Ausgabe-Format: `"{wert}{einheit} runs"` -- Leerzeichen zwischen Zahl und "runs", kein Leerzeichen zwischen Zahl und Einheit (z.B. `"2.3M runs"`, nicht `"2.3 M runs"`)
- Schwellenwerte: `>= 1_000_000_000` -> `B`; `>= 1_000_000` -> `M`; `>= 1_000` -> `K`; sonst keine Einheit
- Dezimalstellen: maximal eine, nur wenn ungleich null (d.h. `"1.5K"` aber `"2M"`, nicht `"2.0M"`)

**Referenzen:**
- Architecture: `specs/phase-2/2026-03-07-model-cards/architecture.md` -> Section "Data Transfer Objects" (`CollectionModel.run_count: number`)
- Slice 06: `slice-06-model-card-component.md` -> Constraints (`run_count` wird als Zahl entgegengenommen; Formatter kommt in Slice 09, Integration in Slice 08)
