# SLIM Plan-Spec Template

Schlankes Template für Task-Driven Slice-Spezifikationen.
Fokus auf WAS (ACs, Tests, Contracts), nicht WIE (kein Code).

---

```markdown
# Slice {N}: {Kurzer Imperativ-Titel}

> **Slice {N} von {Total}** für `{Feature-Name}`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-{NN}-{kurzer-name}` |
| **Test** | `{test command}` |
| **E2E** | `false` |
| **Dependencies** | `[]` oder `["slice-01-db"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

> **Quelle:** Auto-detected vom Slice-Writer Agent basierend auf Repo-Indikatoren.

| Key | Value |
|-----|-------|
| **Stack** | `{auto-detected}` |
| **Test Command** | `{unit test command}` |
| **Integration Command** | `{integration test command}` |
| **Acceptance Command** | `{acceptance test command}` |
| **Start Command** | `{app start command}` |
| **Health Endpoint** | `{health check URL}` |
| **Mocking Strategy** | `{mock_external / no_mocks / test_containers}` |

---

## Ziel

{1-3 Sätze: Was dieser Slice erreicht und warum.}

---

## Acceptance Criteria

1) GIVEN {Vorbedingung}
   WHEN {Aktion}
   THEN {Erwartetes Ergebnis mit konkreten Werten}

2) GIVEN ...
   WHEN ...
   THEN ...

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstständig.

### Test-Datei: `{test file path}`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('{Slice Name}', () => {
  // AC-1: {AC-Titel}
  it.todo('should {erwartetes Verhalten aus AC-1}')

  // AC-2: {AC-Titel}
  it.todo('should {erwartetes Verhalten aus AC-2}')

  // AC-N: {AC-Titel}
  it.todo('should {erwartetes Verhalten aus AC-N}')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| {slice-id} | `{resource}` | {Function/Component/Schema} | {wie prüfen} |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `{resource}` | {Function/Component/Schema} | {slice-id} | `{Signatur}` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `{pfad/datei.ts}` — {Kurzbeschreibung}
- [ ] `{pfad/datei.ts}` — {Kurzbeschreibung}
- [ ] `{test/pfad.test.ts}` — Tests für AC-1 bis AC-N
<!-- DELIVERABLES_END -->

---

## Constraints

**Scope-Grenzen:**
- {Was dieser Slice NICHT macht}

**Technische Constraints:**
- {z.B. "Nutze Drizzle ORM, nicht raw SQL"}
- {z.B. "Server Components für Data Fetching"}

**Referenzen:**
- Architecture: `{spec_path}/architecture.md` → {relevante Section}
- Wireframes: `{spec_path}/wireframes.md` → {relevante Section}
```

---

## Prinzipien

- **~150-300 Zeilen** pro Slice (nicht 1.500+)
- **Kein Code** — der Implementer schreibt Code, nicht der Planner
- **Keine Wireframe-Kopien** — Referenz auf wireframes.md Section genügt
- **Keine Architecture-Kopien** — Referenz auf architecture.md Section genügt
- **Tests als Skeletons** — `it.todo()` mit AC-Referenz, Test-Writer implementiert
- **ACs sind der Vertrag** — konkrete Werte, messbar, testbar
