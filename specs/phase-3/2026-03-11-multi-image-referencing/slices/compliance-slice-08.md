# Gate 2: Slim Compliance Report -- Slice 08

**Geprufter Slice:** `specs/phase-3/2026-03-11-multi-image-referencing/slices/slice-08-reference-bar.md`
**Prufdatum:** 2026-03-12

---

## Phase 2: Deterministic Checks

| Check | Status | Detail |
|-------|--------|--------|
| D-1: Metadata | PASS | Alle 4 Felder vorhanden: ID=`slice-08-reference-bar`, Test=`pnpm test ...`, E2E=`false`, Dependencies=`["slice-07-reference-slot"]` |
| D-2: Test-Strategy | PASS | Alle 7 Felder vorhanden: Stack, Test Command, Integration Command, Acceptance Command, Start Command, Health Endpoint, Mocking Strategy |
| D-3: AC Format | PASS | 11 ACs (AC-1 bis AC-11), alle enthalten GIVEN, WHEN, THEN |
| D-4: Test Skeletons | PASS | 11 Test-Cases (it.todo) vs 11 ACs. `<test_spec>` Block vorhanden. Pattern `it.todo(` und `describe(` erkannt (typescript-nextjs Stack). |
| D-5: Integration Contract | PASS | "Requires From Other Slices" Tabelle mit 4 Eintraegen, "Provides To Other Slices" Tabelle mit 2 Eintraegen |
| D-6: Deliverables Marker | PASS | `<!-- DELIVERABLES_START -->` und `<!-- DELIVERABLES_END -->` vorhanden. 1 Deliverable mit Dateipfad `components/workspace/reference-bar.tsx` |
| D-7: Constraints | PASS | 6 Scope-Grenzen + 5 technische Constraints definiert |
| D-8: Groesse | PASS | 203 Zeilen (unter 400). Test-Skeleton-Codeblock ist 53 Zeilen (mandatorischer `<test_spec>` Block, kein Code-Example). |
| D-9: Anti-Bloat | PASS | Keine `## Code Examples` Section, keine ASCII-Art Wireframes, kein DB-Schema kopiert, keine vollstaendigen Type-Definitionen |
| D-10: Codebase Reference | SKIP | Deliverable ist eine NEUE Datei (`reference-bar.tsx`). Requires-Eintraege referenzieren Ressourcen aus vorherigen Slices (slice-06, slice-07) -- diese erstellen die Dateien als neue Files. |

**Phase 2 Verdict:** PASS

---

## Phase 3: LLM Content Checks

| Check | Status | Detail |
|-------|--------|--------|
| L-1: AC-Qualitaet | PASS | Siehe Detail unten |
| L-2: Architecture Alignment | PASS | Siehe Detail unten |
| L-3: Contract Konsistenz | PASS | Siehe Detail unten |
| L-4: Deliverable-Coverage | PASS | Siehe Detail unten |
| L-5: Discovery Compliance | PASS | Siehe Detail unten |
| L-6: Consumer Coverage | SKIP | Kein MODIFY-Deliverable -- nur neue Datei `reference-bar.tsx` |

### L-1: AC-Qualitaet

Alle 11 ACs sind testbar, spezifisch und messbar:
- **Testbarkeit:** Jedes AC beschreibt einen konkreten UI-State oder Verhaltens-Trigger, der mit Testing Library pruefbar ist.
- **Spezifitaet:** Konkrete Werte vorhanden (z.B. "[3/5]", "@1, @3, @5", "References (0)", Position "@2", "image/png, image/jpeg, image/webp").
- **GIVEN Vollstaendigkeit:** Alle Vorbedingungen praezise (z.B. "mit 3 Referenzen (Positionen @1, @3, @5)", "mit exakt 5 Slots (@1 bis @5)").
- **WHEN Eindeutigkeit:** Jedes AC hat genau eine Aktion (Rendern, Klick, Hinzufuegen, Entfernen).
- **THEN Messbarkeit:** Alle Ergebnisse sind maschinell pruefbar (DOM-Elemente, disabled-State, Counter-Text, Position-Zuweisung).

### L-2: Architecture Alignment

- **Component-Pfad:** `components/workspace/reference-bar.tsx` stimmt mit Architecture Section "Architecture Layers" ueberein (`components/workspace/reference-*.tsx`).
- **Max 5 Referenzen:** AC-8 erzwingt 5-Slot-Maximum, konsistent mit Architecture "Validation Rules" (`References count <= 5 per generation`).
- **Sparse Numbering:** AC-6, AC-7, AC-10 implementieren den Sparse-Label-Algorithmus, konsistent mit Architecture "Constraints & Integrations" (`Sparse slot numbering`).
- **Collapsible Pattern:** Slice nutzt shadcn Collapsible (aus Slice 06), konsistent mit Architecture "Technology Decisions" (`Collapsible: shadcn/ui Collapsible (Radix)`).
- **Controlled Component:** Constraints definieren "Alle Daten und Callbacks als Props", konsistent mit Architecture Data Flow (UI -> Server Action -> Service).
- Keine Widersprueche gefunden.

### L-3: Contract Konsistenz

- **Requires From slice-07:** `ReferenceSlot` Component, `ReferenceSlotData` Type, `ReferenceRole`/`ReferenceStrength` Types -- alle in slice-07 "Provides To" Tabelle vorhanden mit identischen Interfaces.
- **Requires From slice-06:** `Collapsible` Component -- in slice-06 "Provides To" Tabelle vorhanden.
- **Provides To slice-09:** `ReferenceBar` Component mit Props-Interface `slots, onAdd, onRemove, onRoleChange, onStrengthChange, onUpload, onUploadUrl` -- plausibel fuer PromptArea-Integration.
- **Provides Sparse-Label-Algorithmus:** `getLowestFreePosition(occupiedPositions: number[]): number` -- Consumer slice-09 und slice-14 genannt. Funktion ist intern in reference-bar.tsx, aber exportiert fuer Wiederverwendung.
- Interface-Signaturen sind typenkompatibel: ReferenceSlot erwartet `slotData: ReferenceSlotData | null`, ReferenceBar uebergibt `ReferenceSlotData[]` (per Slot aufgeloest).

### L-4: Deliverable-Coverage

- **AC-1 bis AC-11** alle referenzieren Verhalten von `reference-bar.tsx` (das einzige Deliverable):
  - AC-1/2: Header-Rendering (collapsed states)
  - AC-3/4: Collapse/Expand Toggle
  - AC-5: Auto-Expand
  - AC-6/7/10: Sparse Numbering Logik
  - AC-8: Max-Slots Enforcement
  - AC-9: Trailing Empty Dropzone
  - AC-11: Add-Button File Dialog
- **Kein verwaistes Deliverable:** Das einzige Deliverable wird von allen 11 ACs benoetigt.
- **Test-Deliverable:** Test-Skeleton definiert in `components/workspace/__tests__/reference-bar.test.tsx` (wird vom Test-Writer erstellt, nicht als Deliverable gelistet -- konform mit Slice-Konvention).

### L-5: Discovery Compliance

- **Feature State Machine (Reference Bar State):** Discovery definiert 3 Bar-States (`collapsed-empty`, `collapsed-filled`, `expanded`). AC-1 deckt collapsed-empty, AC-2 deckt collapsed-filled, AC-3/4 decken expand/collapse Toggle ab. Vollstaendig.
- **Business Rules:**
  - "Max 5 Referenzen" -> AC-8 (disabled bei 5/5). Abgedeckt.
  - "Slot-Labels stabil, kein Re-Numbering" -> AC-7 (stabile Labels nach Remove). Abgedeckt.
  - "Neue Bilder fuellen niedrigste freie Nummer" -> AC-6, AC-10. Abgedeckt.
  - "Default-Rolle Content" -> Nicht explizit in AC, aber Slice-Scope deckt nur Container-Logik, ReferenceSlot (Slice 07) handhabt Defaults. Korrekte Scope-Trennung.
  - "Upload-Formate PNG/JPG/JPEG/WebP" -> AC-11 (accept: image/png, image/jpeg, image/webp). Abgedeckt.
- **Wireframes:**
  - Screen "Reference Bar -- Collapsed Empty": Chevron-Right + "References (0)" + [+ Add] -> AC-1 deckt dies ab.
  - Screen "Reference Bar -- Collapsed with Images": Counter-Badge [3/5] + Mini-Thumbnails -> AC-2 deckt dies ab.
  - Screen "Prompt Area -- img2img Mode": Trailing Empty Dropzone -> AC-9 deckt dies ab.
- **Kein fehlender User-Flow-Schritt:** Die wesentlichen ReferenceBar-Interaktionen (Add, Remove, Expand/Collapse, Auto-Expand) sind alle in ACs abgebildet.

---

## Blocking Issues

Keine.

---

## Verdict

**VERDICT: APPROVED**

**Blocking Issues:** 0
