# Orchestrator Configuration: Interactive Prompt Refinement in Assistant with Per-Project Context

**Integration Map:** `integration-map.md`
**E2E Checklist:** `e2e-checklist.md`
**Generated:** 2026-05-09

---

## Pre-Implementation Gates

```yaml
pre_checks:
  - name: "Gate 1: Architecture Compliance"
    file: "gates/compliance-architecture.md"
    required: "Verdict == APPROVED"
    status: confirmed

  - name: "Gate 2: All Slices Approved"
    files: "gates/compliance-slice-*.md"
    required: "ALL Verdict == APPROVED"
    status: 28/28 confirmed

  - name: "Gate 3: Integration Map Valid"
    file: "gates/integration-map.md"
    required: "Missing Inputs == 0 AND Verdict == READY FOR ORCHESTRATION"
    status: confirmed
```

---

## Prerequisites (Infrastructure)

### PREREQUISITE 1: Frontend Health-Endpoint `/api/health`

**Status:** MISSING

Several slices (16, 17, 18, 22, 27) reference `http://localhost:3000/api/health` as Health Endpoint in ihrer Test-Strategy-Section. Diese Route existiert aktuell NICHT im Codebase (`app/api/health/route.ts` fehlt).

**Vorgeschlagene Implementierung (Next.js 16 App Router):**

```typescript
// app/api/health/route.ts
export const runtime = "nodejs";

export async function GET() {
  return Response.json({ status: "ok" }, { status: 200 });
}
```

**Action:** Vor Wave 4 (Frontend-Slices 16+) muss Slice 00-Infra einen Health-Endpoint anlegen, ODER diese Route wird als Pre-Wave-1-Setup aufgenommen. Empfohlen: Sofort als trivialer Setup-PR vor Wave 1.

### PREREQUISITE 2: Backend Health-Endpoint `/api/assistant/health`

**Status:** EXISTS (verified in `backend/app/routes/health.py:8` und `backend/app/main.py:44`)

Hinweis: Mehrere Backend-Slices schreiben `GET http://localhost:8000/health`, aber der reale Pfad ist `http://localhost:8000/api/assistant/health` (Prefix in `main.py:44`). Test-Writer muss diesen korrekten Pfad verwenden — KEIN neuer Endpoint nötig.

### PREREQUISITE 3: Postgres-Datenbank im Stand `0014`

**Status:** EXISTS (Migration `0014_drop_model_slots_active.sql` ist letzte vorhandene Migration)

Slice 01 generiert `0015`, Migration up muss vor allen anderen Slices laufen (siehe Wave 1).

### PREREQUISITE 4: OpenRouter API-Key + Model Allowlist

**Status:** EXISTS (siehe `backend/app/config.py` Allowlist-Definition)

Slice 08 (Help-Me-Write) und Slice 11/12 (LLM-Calls) konsumieren existierenden OpenRouter-Client. Allowlist enthält: `anthropic/claude-sonnet-4.6`, `openai/gpt-5.4`, `google/gemini-3.1-pro-preview` — die exakt gleichen IDs werden in Slice 20 `CHAT_LLM_LIMITS` dupliziert.

---

## Implementation Order

Implementations-Reihenfolge basierend auf Dependency-Analyse. Slices innerhalb einer Wave sind parallelisierbar (keine direkten Abhängigkeiten zwischeneinander).

| Wave | Slice | Name | Depends On | Parallel? |
|------|-------|------|------------|-----------|
| **0** | (Setup) | Frontend Health-Endpoint `/api/health` | -- | -- |
| **1** | 01 | Schema Migration für Project-Context | -- | No (foundation) |
| **2** | 02 | DB-Query-Helpers für Context | 01 | No |
| **2** | 05 | FastAPI ProjectRepository | 01 | Yes (parallel zu 02) |
| **3** | 03 | Next.js Route Handlers context | 02 | Yes |
| **3** | 04 | Server Action updateProjectContext | 02 | Yes |
| **4** | 06 | Project-Context-Settings UI | 03, 04 | No |
| **4** | 08 | Help-Me-Write Route Handler | 03 | Yes (parallel zu 06) |
| **4** | 10 | No-Context-Hint-Banner | 03 | Yes (parallel zu 06+08) |
| **4** | 11 | System-Prompt-Komposition mit Context | 05 | Yes (parallel zu 06+08+10) |
| **5** | 07 | Project-List + Workspace-Header Edit-Entries | 06 | No |
| **5** | 09 | Help-Me-Write Modal-Komponente | 08, 06 | Yes |
| **5** | 12 | Base-Prompt-Rewrite (Interview-Verhalten) | 11 | Yes |
| **6** | 13 | emit_intent_summary Agent-Tool | 12 | No |
| **6** | 19 | ReferenceSlot-DTO + SendMessageRequest-Erweiterung | 12 | Yes (parallel zu 13) |
| **6** | 26 | Paste-Detect-Heuristik | 12 | Yes (parallel) |
| **7** | 14 | FSM-State-Extension in PromptAssistantState | 13 | No |
| **7** | 20 | chat_llm_limits-Modul | 19 | Yes |
| **7** | 23 | i2i-Settings-Tools | 13 | Yes |
| **8** | 15 | SSE-Events flow-state + intent-summary | 14 | No |
| **8** | 21 | Multimodal-Pipeline + Budget-Enforcement | 20 | Yes |
| **8** | 24 | Frontend-Handler für Slot-Tools | 23 | Yes |
| **9** | 16 | IntentSummaryCard-Komponente | 15 | No |
| **9** | 25 | Multi-Reference-Interview Eval-Suite | 24, 12 | Yes |
| **10** | 17 | Auto-Apply + Auto-Generate Handler | 16 | No |
| **10** | 22 | Multimodal-Indicator UI | 21, 18-prep ⚠️ | Note: 22 wartet auf 18 |
| **10** | 27 | PasteDetectConfirmCard-Komponente | 26, 16 | Yes (parallel zu 17) |
| **10** | 28 | Session-Resume mit FSM-Hydrate | 16 | Yes |
| **11** | 18 | Result-Image als Multimodal-Input | 17 | No |
| **12** | 22 | Multimodal-Indicator UI (now full) | 21, 18 | -- (re-arranged) |

> **Note Wave 10/11/12:** Slice 22 hat zwei Dependencies (21 + 18). Da 18 erst nach 17 läuft, wird Slice 22 auf Wave 12 verschoben. Wave 10 bleibt: 17 + 27 + 28 (parallel).

### Vereinfachter Wave-Plan (final)

```yaml
waves:
  wave_0_setup:
    parallel: false
    items:
      - "Add app/api/health/route.ts (trivial 200 OK endpoint)"

  wave_1_foundation:
    parallel: false
    items: ["slice-01"]

  wave_2_data_layer:
    parallel: true
    items: ["slice-02", "slice-05"]

  wave_3_api_layer:
    parallel: true
    items: ["slice-03", "slice-04"]

  wave_4_first_user_value:
    parallel: true
    items: ["slice-06", "slice-08", "slice-10", "slice-11"]
    note: "Settings-UI, Help-Me-Write-Route, Banner, Backend-Prompt-Composition"

  wave_5_secondary_ui_and_prompt_redesign:
    parallel: true
    items: ["slice-07", "slice-09", "slice-12"]

  wave_6_tool_and_dto_layer:
    parallel: true
    items: ["slice-13", "slice-19", "slice-26"]

  wave_7_state_and_limits:
    parallel: true
    items: ["slice-14", "slice-20", "slice-23"]

  wave_8_sse_and_pipeline:
    parallel: true
    items: ["slice-15", "slice-21", "slice-24"]

  wave_9_card_and_eval:
    parallel: true
    items: ["slice-16", "slice-25"]

  wave_10_handlers_and_polish:
    parallel: true
    items: ["slice-17", "slice-27", "slice-28"]

  wave_11_result_loop:
    parallel: false
    items: ["slice-18"]

  wave_12_indicator:
    parallel: false
    items: ["slice-22"]
```

---

## Post-Slice Validation

FOR each completed slice:

```yaml
validation_steps:
  - step: "Deliverables Check"
    action: "Verify all files in DELIVERABLES_START/END markers exist"

  - step: "Unit/Integration Tests"
    action: "Run slice-specific Test Command from slice metadata"
    examples:
      - "slice-01: pnpm drizzle-kit migrate (up) + manual down-verify"
      - "slice-02: pnpm test lib/db/__tests__/queries.test.ts"
      - "slice-12: cd backend && python -m pytest tests/unit/test_base_prompt_eval.py -v"

  - step: "Integration Points Check"
    action: "Verify outputs accessible by dependent slices"
    reference: "integration-map.md → Connections-Tabelle"

  - step: "Type-Check"
    action: "pnpm tsc --noEmit (für TS-Slices) OR mypy (für Backend, falls konfiguriert)"
```

---

## E2E Validation

AFTER all slices completed:

```yaml
e2e_validation:
  - step: "Execute e2e-checklist.md Flow 1-6 + Edge Cases"

  - step: "FOR each failing check"
    actions:
      - "Identify responsible slice from Integration Map → Connections-Tabelle"
      - "Create fix task with slice reference"
      - "Re-run affected slice tests"

  - step: "Critical Cross-Slice E2E"
    runs:
      - "Flow 1 (txt2img full happy-path): tests/e2e/auto-apply-generate.spec.ts + result-image-multimodal.spec.ts"
      - "Flow 2 (i2i full): tests/e2e/multimodal-indicator.spec.ts + multi-reference-flow (pytest)"
      - "Flow 3 (paste-detect): tests/e2e/paste-detect-confirm-card.spec.ts"
      - "Flow 4 (context-edit): tests/e2e/project-context-settings.spec.ts + help-me-write-modal.spec.ts"
      - "Flow 5 (banner): e2e/assistant/no-context-banner.spec.ts"
      - "Flow 6 (resume): e2e/assistant-session-resume.spec.ts"

  - step: "Final Approval"
    condition: "ALL checks in e2e-checklist.md PASS"
    output: "Feature READY for merge"
```

---

## Rollback Strategy

IF implementation fails:

```yaml
rollback:
  - condition: "Slice 01 (DB-Schema) fails"
    action: "drop columns context_instructions, context_updated_at; revert lib/db/schema.ts"
    impact: "Critical — blocks all subsequent slices"

  - condition: "Slice in Wave 2-3 fails"
    action: "Revert slice changes only; Foundation (01) bleibt stabil"
    impact: "Subsequent waves blocked until fix"

  - condition: "Slice in Wave 4+ fails (UI/UX)"
    action: "Feature-Flag oder Revert; vorherige Slices bleiben funktional"
    impact: "Partial feature; Settings-UI ohne Helper Modal usable"

  - condition: "Slice 12 (Base-Prompt-Rewrite) Eval-Set < 5 cases pass"
    action: "Iterate on Prompt-Inhalte (gleiche Datei), re-run Eval-Suite"
    note: "Prompt-Engineering ist iterativ; Constraint AC-7 erlaubt 1500..8000 chars"

  - condition: "Slice 13/14 mit FSM-State-Issue"
    action: "Backward-Compat-Defaults greifen; Slice 28 Resume-Test verifiziert"

  - condition: "Slice 21 (Multimodal Pipeline) Budget-Enforcement bug"
    action: "Disable Multimodal via DEFAULT_LIMITS-only-Pfad (vision=False für alle)"
    note: "Feature funktioniert weiterhin als reiner Text-Assistant"

  - condition: "Integration fails (E2E)"
    action: "Review integration-map.md für Gaps; gegebenenfalls Slice-Spec-Updates"
```

---

## Monitoring

During implementation:

| Metric | Alert Threshold | Source |
|--------|-----------------|--------|
| Slice completion time | > 2x estimate | Orchestrator-Log |
| Test failures | > 0 blocking | CI-Output |
| Deliverable missing | Any | Post-Slice-Validation |
| Integration test fail | Any | E2E-Run |
| Discovery-Coverage | < 100% | integration-map.md Section "Discovery Traceability" |
| Eval-Set (Slice 12) | < 5 cases pass | Pytest-Output |
| Multi-Reference Eval (Slice 25) | < 3 cases pass | Pytest-Output |

### Slice-spezifische Monitoring-Punkte

| Slice | Special Watch |
|-------|---------------|
| 01 | Migration up/down idempotent (kein DB-Lock) |
| 03 | Status-Code-Mapping korrekt (401/200/404/422) |
| 11 | Project-Context Plaintext NICHT in Logs (Privacy) |
| 12 | Anti-Phrase "kein Fragebogen" entfernt + alle Pflicht-Phrasen vorhanden |
| 14 | LangGraph-Checkpointer serialisiert TypedDict-Felder verlustfrei |
| 17 | Auto-Retry feuert genau einmal (kein Endlos-Retry) |
| 21 | Vision-Fallback ist silent (kein User-Error) |
| 22 | Reactive State-Lifting bricht keine bestehenden useWorkspaceVariation-Consumer |
| 28 | Pre-Slice-14-Sessions laden ohne 500-Error (Backward-Compat) |

---

## Critical Path

Der schnellste Pfad zu sichtbarem User-Value:

1. Wave 0 (Setup health-endpoint) — trivial
2. Wave 1 (01) — 1 PR, schema-only
3. Wave 2 (02 + 05) — 2 parallele PRs
4. Wave 3 (03 + 04) — 2 parallele PRs
5. Wave 4 (06 + 08 + 10 + 11) — 4 parallele PRs → **Settings-UI funktioniert** + **Banner sichtbar** + **Helper-Route ready**
6. Wave 5 (07 + 09 + 12) — 3 parallele PRs → **Edit-Entries verdrahtet**, **Helper-Modal funktioniert**, **neuer Interview-Prompt aktiv**
7. Wave 6-12: schrittweise Aufbau des Interview/Generate/Refinement-Loops

Nach Wave 5 (~12 Slices) hat der User:
- Funktionierende Project-Context-Settings (Edit + Save + Helper-Modal)
- No-Context-Banner als Onboarding-Nudge
- Neuen Interview-LLM (auch ohne Card-UI bereits aktiv)

Der vollständige Auto-Generate-Loop steht erst nach Wave 11 (Slice 18).

---

## Verdict

**VERDICT: READY FOR ORCHESTRATION**

- 28/28 Slices APPROVED
- 56/56 Connections valid
- 0 Missing Inputs
- 0 Deliverable-Consumer Gaps
- 0 Runtime Path Gaps
- 0 Semantic Consistency Gaps
- Discovery-Coverage 100%
- 1 dokumentierter Infrastructure-Prerequisite (Frontend-Health-Endpoint) → Wave 0 Setup-Item

Orchestrator kann mit Wave 0 starten.
