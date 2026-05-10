# Slice 26: Paste-Detect-Heuristik

> **Slice 26 von 28** für `Interactive Prompt Refinement in Assistant with Per-Project Context`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-26-paste-detect-heuristic` |
| **Test** | `pnpm test lib/assistant/paste-detect` |
| **E2E** | `false` |
| **Dependencies** | `["slice-12-base-prompt-rewrite-interview"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/assistant/paste-detect` |
| **Integration Command** | `pnpm test lib/assistant/paste-detect` |
| **Acceptance Command** | `pnpm test lib/assistant/paste-detect` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000/api/health` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Pure Frontend-Heuristik `detectPastedPrompt(text)` bereitstellen, die erkennt, ob eine User-Message wie ein fertig-gepasteter Prompt aussieht. Liefert deterministisches Boolean ohne Backend-Roundtrip — Grundlage für die Paste-Detect-Confirm-Card (Slice 27).

---

## Acceptance Criteria

1) GIVEN ein Input-String mit `< 80` Zeichen
   WHEN `detectPastedPrompt(text)` aufgerufen wird
   THEN Rückgabewert ist `false` (Length-Bedingung verfehlt, frühe Negation reicht)

2) GIVEN ein Input-String mit `>= 80` Zeichen, aber weniger als 6 komma-separierten Tokens
   WHEN `detectPastedPrompt(text)` aufgerufen wird
   THEN Rückgabewert ist `false` (Komma-Token-Bedingung verfehlt)

3) GIVEN ein Input-String mit `>= 80` Zeichen, `>= 6` Komma-Tokens, aber `< 2` Style-Keyword-Treffern
   WHEN `detectPastedPrompt(text)` aufgerufen wird
   THEN Rückgabewert ist `false` (Style-Keyword-Bedingung verfehlt)

4) GIVEN ein typischer Style-Prompt mit `>= 80` Zeichen, `>= 6` Komma-Tokens UND `>= 2` Style-Keyword-Treffern (z.B. "cinematic, photorealistic, …")
   WHEN `detectPastedPrompt(text)` aufgerufen wird
   THEN Rückgabewert ist `true` (alle drei Bedingungen erfüllt)

5) GIVEN Edge-Cases: leerer String `""`, nur Whitespace `"   "`, nur Kommas `",,,,,,"`, einzelnes Wort
   WHEN `detectPastedPrompt(text)` für jeden Fall aufgerufen wird
   THEN Rückgabewert ist `false` (keine Exception, deterministisch)

6) GIVEN ein Style-Keyword in Mixed-Case (z.B. `"Cinematic"`, `"PHOTOREALISTIC"`)
   WHEN `detectPastedPrompt(text)` aufgerufen wird
   THEN Keyword-Matching ist case-insensitive — `Cinematic` zählt als Treffer wie `cinematic`

7) GIVEN ein String mit Kommas in Whitespace-Variationen (`", "`, `","`, `" , "`)
   WHEN Komma-Tokens gezählt werden
   THEN leere Tokens (entstehen durch trailing comma oder doppelte Kommas) werden NICHT mitgezählt — nur nicht-leere getrimmte Tokens

8) GIVEN derselbe Input-String wird mehrfach gerufen
   WHEN `detectPastedPrompt(text)` deterministisch aufgerufen wird
   THEN Rückgabewert ist bei jedem Aufruf identisch (pure function, kein State, keine Side-Effects)

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC. Der Test-Writer implementiert die Assertions selbstständig.
> **Style-Keyword-Liste:** Quelle of Truth ist `lib/assistant/paste-detect.ts` (vom Implementer kuratiert). Tests konsumieren echte Strings, KEINE Whitebox-Tests gegen die Liste.

### Test-Datei: `lib/assistant/paste-detect.test.ts`

<test_spec>
```typescript
// AC-1: Length < 80 → false
it.todo('returns false when input is shorter than 80 characters')

// AC-2: Length OK, comma tokens < 6 → false
it.todo('returns false when comma-separated tokens are fewer than 6')

// AC-3: Length + commas OK, style-keywords < 2 → false
it.todo('returns false when fewer than 2 style-keyword hits are found')

// AC-4: All three conditions met → true (typical pasted style-prompt)
it.todo('returns true for a typical comma-heavy style prompt')

// AC-5: Edge-cases (empty, whitespace, only commas, single word) → false, no throw
it.todo('returns false for edge-case inputs without throwing')

// AC-6: Case-insensitive style-keyword matching
it.todo('matches style keywords case-insensitively')

// AC-7: Empty/whitespace-only comma tokens are not counted
it.todo('ignores empty tokens produced by trailing or repeated commas')

// AC-8: Pure function — deterministic, no side-effects
it.todo('is deterministic across repeated calls with the same input')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-12-base-prompt-rewrite-interview` | (logical only) Backend treats every first message uniformly | Behavioral | Heuristik ist Frontend-pure; keine direkte Code-Abhängigkeit, aber Slice 12 stellt sicher, dass Backend nicht eigenständig Paste-Detect-Logik betreibt |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `detectPastedPrompt` | Pure Function | `slice-27-paste-detect-card-component` | `(text: string) => boolean` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/assistant/paste-detect.ts` — Pure Heuristik-Funktion `detectPastedPrompt(text: string): boolean` mit kuratierter Style-Keyword-Liste (Modul-intern als `const`)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Card-Komponente in diesem Slice (kommt in Slice 27).
- KEINE Reducer-Action / Context-Mounting (kommt in Slice 27).
- KEINE Server-/Backend-Logik — Architecture spezifiziert die Heuristik explizit als Frontend-pure (siehe Q&A 9).
- KEIN Tracking, ob es die "erste Message" ist — der Aufrufer (Slice 27) entscheidet das.

**Technische Constraints:**
- Reine TypeScript-Funktion, KEINE React-Imports, KEINE Hooks, KEINE I/O.
- Signatur exakt: `export function detectPastedPrompt(text: string): boolean`. (Hinweis: Architecture-Tabelle nennt formal `{ matches: boolean }` als Output; das atomare Slice-Done-Signal aus `slim-slices.md` und der Konsum durch Slice 27 verlangen Boolean — Implementer folgt dem Slice-Done-Signal.)
- Style-Keyword-Liste als modul-interne `const` (nicht exportiert), kuratiert für typische Bild-Prompt-Vokabeln (z.B. `cinematic`, `photorealistic`, `bokeh`, `4k`, `sharp focus`, `studio lighting`, `volumetric`, `hyperreal`, `concept art`, `octane render` o.ä.).
- Komma-Token-Zählung: trim + filter empty, dann Length.
- Case-insensitive Keyword-Match (lowercase-Normalisierung des Inputs vor Vergleich).
- Schwellwerte exakt wie spezifiziert: `length >= 80`, `tokens >= 6`, `keywordHits >= 2`.

**Referenzen:**
- Architecture: `architecture.md` → Section "Paste-Detect Heuristic (Frontend)" (Zeilen 153–161)
- Architecture: `architecture.md` → Migration Map Eintrag `lib/assistant/paste-detect.ts` (Zeile 532)
- Architecture: `architecture.md` → Q&A 9 ("Where does paste-detect run?") und Trade-offs ("Frontend computes paste-detect heuristic")
- Discovery: `discovery.md` → "Paste-Prompt-Flow" (Schritt 2: Heuristik-Beschreibung) und FSM-Tabelle (`idle → paste_confirmation` Trigger)
- Wireframes: `wireframes.md` → "Screen: Paste Detect Confirm Card" (Kontext für späteren Konsum durch Slice 27)
