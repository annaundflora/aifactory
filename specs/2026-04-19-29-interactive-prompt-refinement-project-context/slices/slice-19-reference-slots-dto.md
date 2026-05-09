# Slice 19: ReferenceSlot-DTO + SendMessageRequest-Erweiterung

> **Slice 19 von 28** für `Interactive Prompt Refinement in Assistant with Per-Project Context`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-19-reference-slots-dto` |
| **Test** | `cd backend && python -m pytest tests/models -v && cd .. && pnpm test lib/assistant` |
| **E2E** | `false` |
| **Dependencies** | `["12-base-prompt-rewrite-interview"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi + typescript-nextjs` |
| **Test Command** | `cd backend && python -m pytest tests/models/test_dtos.py -v && cd .. && pnpm test lib/assistant/use-assistant-runtime.test.ts` |
| **Integration Command** | `cd backend && python -m pytest tests/models -v` |
| **Acceptance Command** | `cd backend && python -m pytest tests/models -v && cd .. && pnpm test lib/assistant` |
| **Start Command** | `pnpm dev` (Next.js) + `cd backend && uvicorn app.main:app --reload` (FastAPI) |
| **Health Endpoint** | `http://localhost:8000/health` |
| **Mocking Strategy** | `no_mocks` (Pydantic-Validation rein lokal; Frontend-Body-Build mit gemocktem `fetch`) |

---

## Ziel

Pydantic-DTO `ReferenceSlotDTO` einführen und `SendMessageRequest` um `project_id`, `reference_slots: list[ReferenceSlotDTO]` (max 5) und `last_result_image_url` erweitern. Frontend-Runtime baut den Body als Snapshot der aktiven Slots und sendet diese ausschließlich, wenn `generationMode === "img2img"`.

---

## Acceptance Criteria

1) **GIVEN** `ReferenceSlotDTO` ist als neues Pydantic-Model in `backend/app/models/dtos.py` definiert
   **WHEN** ein DTO mit `slot_index=2`, `image_url="https://example.com/img.png"`, `role="style"`, `strength=0.8` instanziiert wird
   **THEN** Validation passes; alle Felder sind abrufbar; Schema entspricht architecture.md → Section "Data Models" Zeile 145.

2) **GIVEN** `ReferenceSlotDTO` mit `role`/`strength` als Optional-Felder
   **WHEN** ein DTO nur mit `slot_index=0` und `image_url="https://example.com/a.png"` instanziiert wird (ohne `role`, ohne `strength`)
   **THEN** Validation passes; `role` ist `None`; `strength` ist `None`.

3) **GIVEN** `ReferenceSlotDTO` mit `strength: float (0.0..1.0)`-Constraint
   **WHEN** ein DTO mit `strength=1.5` validiert wird
   **THEN** `ValidationError` wird geworfen mit Hinweis auf den Wertebereich.

4) **GIVEN** `ReferenceSlotDTO` mit `role`-Literal `"subject" | "style" | "composition"`
   **WHEN** ein DTO mit `role="invalid"` validiert wird
   **THEN** `ValidationError` wird geworfen mit Hinweis auf gültige Literale.

5) **GIVEN** `SendMessageRequest` ist um `project_id: UUID | None`, `reference_slots: list[ReferenceSlotDTO] | None` (max_length=5), `last_result_image_url: HttpUrl | None` erweitert
   **WHEN** ein Request mit `content="Hallo"` UND `project_id=<UUID>` UND `reference_slots=[<3 valid DTOs>]` UND `last_result_image_url="https://s3.example.com/r.png"` validiert wird
   **THEN** Validation passes; alle existierenden Felder (`content`, `image_urls`, `model`, `image_model_id`, `generation_mode`) bleiben unverändert akzeptiert (siehe architecture.md → Section "Data Models" Zeile 146).

6) **GIVEN** `SendMessageRequest.reference_slots` mit `max_length=5`
   **WHEN** ein Request mit 6 `ReferenceSlotDTO`-Einträgen validiert wird
   **THEN** Validation schlägt fehl; FastAPI-Endpoint würde 422 zurückgeben.

7) **GIVEN** Backward-Compatibility-Anforderung
   **WHEN** ein Request OHNE `project_id`, OHNE `reference_slots`, OHNE `last_result_image_url` (nur Bestandsfelder) validiert wird
   **THEN** Validation passes; alle drei neuen Felder defaulten auf `None`.

8) **GIVEN** Frontend-Runtime-Hook `use-assistant-runtime.ts` mit neuen Refs `referenceSlotsRef`, `projectIdRef` (Pattern wie bestehende Refs `lines 104-107`)
   **WHEN** `sendMessage` mit `generationModeRef.current === "img2img"` und 2 aktiven Slots aufgerufen wird
   **THEN** Request-Body enthält `reference_slots`-Array mit 2 Snapshot-Einträgen (`slot_index`, `image_url`, `role`, `strength`) UND `project_id`.

9) **GIVEN** Modus-Gate auf `generationModeRef.current === "img2img"`
   **WHEN** `sendMessage` mit `generationModeRef.current === "txt2img"` und 2 aktiven Slots aufgerufen wird
   **THEN** Request-Body enthält KEIN `reference_slots`-Feld (oder leeres Array gemäß DTO-Default `None`); `project_id` wird trotzdem mitgesendet.

10) **GIVEN** Snapshot-Semantik (Slot-Liste wird zum Sende-Zeitpunkt aus Ref gelesen)
    **WHEN** Slot-State zwischen zwei aufeinanderfolgenden `sendMessage`-Calls ändert
    **THEN** jeder Call sendet den jeweils aktuellen Snapshot; keine Caching-Effekte.

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Skeleton referenziert genau ein AC. Test-Writer implementiert die Assertions selbstständig. Stack-Syntax: pytest (Backend) + Vitest (Frontend).

### Test-Datei: `backend/tests/models/test_dtos.py`

<test_spec>
```python
import pytest

# AC-1: ReferenceSlotDTO basic shape
@pytest.mark.skip(reason="AC-1: ReferenceSlotDTO basic shape")
def test_reference_slot_dto_accepts_full_payload():
    ...

# AC-2: ReferenceSlotDTO optional fields default to None
@pytest.mark.skip(reason="AC-2: optional role/strength")
def test_reference_slot_dto_optional_role_and_strength():
    ...

# AC-3: strength range constraint
@pytest.mark.skip(reason="AC-3: strength must be 0.0..1.0")
def test_reference_slot_dto_rejects_strength_above_one():
    ...

# AC-4: role enum constraint
@pytest.mark.skip(reason="AC-4: role literal validation")
def test_reference_slot_dto_rejects_invalid_role():
    ...

# AC-5: SendMessageRequest extended fields accepted
@pytest.mark.skip(reason="AC-5: SendMessageRequest extension")
def test_send_message_request_accepts_project_and_slots_and_last_result():
    ...

# AC-6: max_length=5 on reference_slots
@pytest.mark.skip(reason="AC-6: >5 slots rejected")
def test_send_message_request_rejects_more_than_five_slots():
    ...

# AC-7: backward-compat (no new fields → defaults None)
@pytest.mark.skip(reason="AC-7: backward-compat without new fields")
def test_send_message_request_backward_compat_without_new_fields():
    ...
```
</test_spec>

### Test-Datei: `lib/assistant/use-assistant-runtime.test.ts`

<test_spec>
```typescript
// AC-8: img2img mode includes reference_slots + project_id
it.todo('AC-8: sends reference_slots and project_id when generation mode is img2img')

// AC-9: non-img2img mode omits reference_slots
it.todo('AC-9: omits reference_slots when generation mode is not img2img but keeps project_id')

// AC-10: snapshot semantics across consecutive sendMessage calls
it.todo('AC-10: each sendMessage reads the current ref snapshot, no caching')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-12-base-prompt-rewrite-interview` | Stable Base-Prompt | Prompt-Spec | Slice 12 abgeschlossen; Multi-Reference-Regeln im `_BASE_PROMPT` formuliert (Vorbedingung für sinnvolle Slot-Snapshots) |
| (existing codebase) | `SendMessageRequest` (Bestandsmodel) | Pydantic Model | Datei `backend/app/models/dtos.py:21-59` existiert; `content`, `image_urls`, `model`, `image_model_id`, `generation_mode` bleiben unverändert |
| (existing codebase) | `use-assistant-runtime.ts` Refs-Pattern | Hook-Pattern | Datei `lib/assistant/use-assistant-runtime.ts` Zeilen 104-107 zeigen das `xRef = useRef<...>(...)`-Pattern; neue Refs folgen demselben Pattern |
| (existing codebase) | `generationModeRef` | Ref | Bestehender Ref im Hook hält `"txt2img" | "img2img"` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ReferenceSlotDTO` | Pydantic Model | `slice-21-multimodal-pipeline-budget`, `slice-23-i2i-settings-tools` | `class ReferenceSlotDTO(BaseModel): slot_index: int; image_url: HttpUrl; role: Literal["subject","style","composition"] \| None; strength: float \| None` |
| `SendMessageRequest` (extended) | Pydantic Model | `slice-21-multimodal-pipeline-budget`, `slice-18-result-image-multimodal` (downstream consumer of `last_result_image_url`) | adds `project_id: UUID \| None`, `reference_slots: list[ReferenceSlotDTO] \| None` (max 5), `last_result_image_url: HttpUrl \| None` |
| `referenceSlotsRef`, `projectIdRef` | React Refs (Hook) | `slice-22-multimodal-indicator-ui`, `slice-24-slot-tool-frontend-handler` | `useRef<ReferenceSlotSnapshot[] \| null>(null)`, `useRef<string \| null>(null)` (UUID); subscriber pattern via context |
| Body-Builder-Erweiterung | Hook-Logic | `slice-21-multimodal-pipeline-budget` (Backend-Empfänger) | `body.reference_slots` nur gesetzt bei `generation_mode === "img2img"`; `body.project_id` immer wenn vorhanden |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/app/models/dtos.py` — Edit: neue Klasse `ReferenceSlotDTO`; `SendMessageRequest` um drei Felder erweitern (`project_id`, `reference_slots`, `last_result_image_url`) mit Pydantic-Constraints (`max_length=5`, `HttpUrl`, Literal-Enum)
- [ ] `lib/assistant/use-assistant-runtime.ts` — Edit: zwei neue Refs (`referenceSlotsRef`, `projectIdRef`) im selben Pattern wie bestehende Refs (Zeilen 104-107); Body-Builder (Zeilen 354-373) um drei Felder erweitern; Slot-Inclusion gated auf `generationModeRef.current === "img2img"`
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben. `lastResultImageUrlRef` wird in **Slice 18** ergänzt (siehe slim-slices.md → Slice 18); dieser Slice fügt das DTO-Feld hinzu, der Body-Field-Send-Pfad für `last_result_image_url` wird in Slice 18 verdrahtet.

---

## Constraints

**Scope-Grenzen:**
- KEINE Vision-Fallback-Logik (gehört zu Slice 21).
- KEINE Budget-Enforcement (Slice 21).
- KEINE neue Konstanten-Datei `chat_llm_limits.py` (Slice 20).
- KEINE Backend-Pipeline-Konsumierung der neuen Felder (Slice 21 verdrahtet `_build_human_message`).
- KEINE neuen SSE-Events.
- KEINE UI-Anzeige (Multimodal-Indicator ist Slice 22).
- KEIN HostAllowlist-Check (laut architecture.md Section "Input Validation"; bleibt eine Backend-Validation, kommt mit Slice 21 oder als Follow-up — dieser Slice nutzt nur `HttpUrl`-Standardvalidator).

**Technische Constraints:**
- Pydantic v2 (existing in `dtos.py`); nutze `Field(..., ge=0.0, le=1.0)` für `strength`, `Field(..., max_length=5)` für `reference_slots`.
- Backward-Compat ist **Pflicht**: alle drei neuen `SendMessageRequest`-Felder MÜSSEN `Optional` mit Default `None` sein, damit bestehende Clients (Tests, andere Endpoints) nicht brechen.
- Frontend-Refs folgen exakt dem Pattern aus `use-assistant-runtime.ts:104-107` (kein neues Pattern erfinden).
- Body-Builder mutiert das Body-Object nur **conditional**: `reference_slots` wird **weggelassen** (nicht `null` gesetzt) wenn Modus ≠ `img2img` ODER Snapshot leer ist.
- `project_id` wird IMMER gesendet wenn `projectIdRef.current` gesetzt ist (modus-unabhängig — Backend braucht es für `ProjectRepository.get_context`).

**Referenzen:**
- Architecture: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/architecture.md` → Section "Data Models" (Zeilen 142-149) für DTO-Schemas; Section "Multimodal Pipeline" (Zeilen 288-310) für Snapshot-Semantik; Section "Validation Rules" (Zeile 339) für `reference_slots`-Constraints; Section "Source-of-Truth Map" (Zeilen 516, 527) für genaue Datei-Anchors und Reuse-Hinweise.
- Wireframes: `specs/2026-04-19-29-interactive-prompt-refinement-project-context/wireframes.md` → keine direkte UI-Komponente in diesem Slice; Indicator (Slice 22) zeigt später die Snapshot-Inhalte.

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `backend/app/models/dtos.py` (Zeilen 21-59, `SendMessageRequest`) | Edit, NICHT neu schreiben — additive Felder (`project_id`, `reference_slots`, `last_result_image_url`); Bestandsfelder bleiben unangetastet |
| `lib/assistant/use-assistant-runtime.ts` (Zeilen 104-107, Ref-Pattern) | Pattern für neue Refs (`referenceSlotsRef`, `projectIdRef`) — gleiche Signatur (`useRef<...>(null)`), gleiche Stelle im Hook |
| `lib/assistant/use-assistant-runtime.ts` (Zeilen 354-373, Body-Builder) | Edit, NICHT neu schreiben — drei conditional-Felder im JSON-Body ergänzen, Modus-Gate auf bestehendem `generationModeRef.current` |
| `generationModeRef` (existing in `use-assistant-runtime.ts`) | Lesen, NICHT verändern — dient als Modus-Gate für Slot-Inclusion |
