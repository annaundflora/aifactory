# Slice 21: Multimodal-Pipeline + Budget-Enforcement

> **Slice 21 von 28** für `Interactive Prompt Refinement in Assistant with Per-Project Context`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-21-multimodal-pipeline-budget` |
| **Test** | `cd backend && python -m pytest tests/services/test_assistant_service_multimodal.py -v && pnpm test lib/assistant/__tests__/assistant-context.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["20-chat-llm-limits-module"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `python-fastapi` + `typescript-nextjs` (cross-stack: BE pipeline + FE reducer-action) |
| **Test Command** | `cd backend && python -m pytest tests/services/test_assistant_service_multimodal.py -v && pnpm test lib/assistant/__tests__/assistant-context.test.tsx` |
| **Integration Command** | `cd backend && python -m pytest tests/services/ -v && pnpm test lib/assistant/` |
| **Acceptance Command** | `cd backend && python -m pytest -v && pnpm test` |
| **Start Command** | `cd backend && uvicorn app.main:app --reload` (BE) + `pnpm dev` (FE) |
| **Health Endpoint** | `http://localhost:8000/health` |
| **Mocking Strategy** | `mock_external` (LangGraph stream + ChatOpenRouter werden gemockt; Reducer-Tests reine State-Transitionen ohne Netzwerk) |

---

## Ziel

Im `AssistantService` die HumanMessage-Pipeline so erweitern, dass sie multimodal-Content (Text + Chat-Uploads + ReferenceSlots img2img-only + last_result_image_url) zusammenstellt, vor dem LLM-Call gegen modell-spezifische Caps (`chat_llm_limits`) prioritätsbasiert reduziert und bei Non-Vision-Modellen alle Bilder strippt. Bei Slot-Fetch-Fehler emittiert der Service einen SSE-Event `slot-load-failed`, den das Frontend als inline System-Message im Chat-Verlauf rendert (kein Toast).

---

## Acceptance Criteria

1) **Content-Reihenfolge im HumanMessage entspricht Architecture-Pipeline**
   GIVEN ein `SendMessageRequest` mit `content="Test"`, 1 Chat-Upload, 2 ReferenceSlots (img2img), 1 `last_result_image_url`, Vision-Modell mit ausreichendem Budget
   WHEN `AssistantService` die HumanMessage baut
   THEN ist `human_message.content` eine Liste in der Reihenfolge gemäss architecture.md → "Multimodal Pipeline" Sequenz: `[text-part, *image_url-parts(image_urls), *image_url-parts(reference_slots), image_url-part(last_result_image_url)]`

2) **ReferenceSlots werden bei `generation_mode != "img2img"` ignoriert (defensive Re-Check)**
   GIVEN ein Request mit `generation_mode="txt2img"` und 3 `reference_slots`
   WHEN HumanMessage gebaut wird
   THEN enthält die Content-Liste KEINE der Slot-`image_url`-Parts (auch wenn DTO sie mitsendet — Backend re-checkt per architecture.md → Constraints "Reference slots → assistant only in img2img")

3) **Priority-Drop reduziert auf max_images-Cap (niedrigste Priorität zuerst)**
   GIVEN ein Vision-Modell mit `max_images=4` (z.B. `openai/gpt-5.4`), 2 ReferenceSlots (Prio 1), 1 last_result (Prio 2), 3 Chat-Uploads (Prio 3) → 6 Bilder gesamt
   WHEN HumanMessage gebaut wird
   THEN enthält die finale Content-Liste genau 4 Bild-Parts: 2 ReferenceSlots + 1 last_result + 1 Chat-Upload (neuestes); die 2 ältesten Chat-Uploads sind gedroppt (Drop-Order: Prio 3 → 2 → 1)

4) **Priority-Drop respektiert Architecture-Reihenfolge bei Cap=2**
   GIVEN ein Vision-Modell mit `max_images=2`, 2 Refs + 1 last_result + 2 Chat-Uploads (5 Bilder)
   WHEN HumanMessage gebaut wird
   THEN enthält die finale Content-Liste genau 2 Bild-Parts: beide ReferenceSlots; last_result und alle Chat-Uploads sind gedroppt (höchste Priorität bleibt)

5) **Vision-Fallback strippt alle Bild-Parts**
   GIVEN ein Modell mit `get_chat_llm_limits(model_id)["vision"] is False` (unbekanntes Modell oder explizit Non-Vision) und ein Request mit Refs + last_result + Chat-Uploads
   WHEN HumanMessage gebaut wird
   THEN enthält die Content-Liste ausschliesslich den Text-Part; KEIN `image_url`-Part bleibt erhalten; ein WARNING-Log mit Modell-ID wird geschrieben (architecture.md → "Vision fallback determinism")

6) **Slot-Load-Failure emittiert SSE-Event und überspringt Slot**
   GIVEN ein Vision-Modell und eine `reference_slots`-Liste mit `slot_index=2`, deren `image_url`-Fetch/Validation scheitert (z.B. invalid URL oder fetch_failed)
   WHEN HumanMessage gebaut wird
   THEN wird ein SSE-Event `{"event": "slot-load-failed", "data": {"slot_index": 2, "reason": "fetch_failed" | "invalid_url"}}` emittiert (per `SlotLoadFailedPayload` aus architecture.md Section 2 Wire-Contracts), der betroffene Slot ist NICHT in der finalen Content-Liste, andere Slots werden weiter verarbeitet

7) **Reducer-Action `RENDER_SYSTEM_MESSAGE` rendert inline System-Bubble (kein Toast)**
   GIVEN AssistantState mit existierender `messages`-Liste
   WHEN Reducer mit `{type: "RENDER_SYSTEM_MESSAGE", payload: {slot_index: 2, reason: "fetch_failed"}}` dispatched wird
   THEN enthält der neue State eine zusätzliche Message vom Typ `"system"` (oder gleichwertige Variante) mit Text gemäss architecture.md ("Slot N konnte nicht geladen werden — bitte neu hochladen"), eingefügt in chronologischer Reihenfolge; KEIN Toast wird ausgelöst (Reducer dispatcht nur State-Mutation)

8) **`max_total_bytes`-Cap droppt unabhängig von `max_images`**
   GIVEN ein Vision-Modell mit `max_total_bytes=16_000_000` und 3 Bilder, deren kumulierte Grösse 20_000_000 Bytes überschreitet, aber `max_images=4` nicht
   WHEN HumanMessage gebaut wird
   THEN wird mindestens das Bild niedrigster Priorität gedroppt, bis die kumulierte Bytes-Summe unter `max_total_bytes` liegt; Drop-Order folgt derselben Priority-Hierarchie wie AC-3

9) **Unbekanntes Modell trifft DEFAULT_LIMITS (vision=False)**
   GIVEN ein `model_id`, das nicht in `CHAT_LLM_LIMITS` steht
   WHEN HumanMessage gebaut wird
   THEN greift `DEFAULT_LIMITS` (Slice 20) und alle Bilder werden gestrippt (Verhalten identisch zu AC-5)

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. Test-Writer implementiert Mocks (LangGraph `astream_events`, ChatOpenRouter, URL-Fetcher) und Assertions selbst.

### Test-Datei: `backend/tests/services/test_assistant_service_multimodal.py`

<test_spec>
```python
import pytest

# AC-1: Content-Reihenfolge im HumanMessage
@pytest.mark.skip(reason="AC-1")
def test_human_message_content_order_matches_pipeline_spec():
    ...

# AC-2: txt2img → ReferenceSlots werden ignoriert
@pytest.mark.skip(reason="AC-2")
def test_reference_slots_ignored_when_mode_is_not_img2img():
    ...

# AC-3: Priority-Drop bei Cap=4 mit 6 Bildern (2 niedrigste droppen)
@pytest.mark.skip(reason="AC-3")
def test_priority_drop_caps_at_max_images_drops_lowest_first():
    ...

# AC-4: Priority-Drop bei Cap=2 behält nur Refs
@pytest.mark.skip(reason="AC-4")
def test_priority_drop_keeps_only_highest_priority_when_cap_tight():
    ...

# AC-5: Vision-Fallback strippt alle Bilder
@pytest.mark.skip(reason="AC-5")
def test_vision_fallback_strips_all_images_for_non_vision_model():
    ...

# AC-6: Slot-Load-Failure emittiert SSE-Event und skipt Slot
@pytest.mark.skip(reason="AC-6")
async def test_slot_load_failed_emits_sse_event_and_skips_slot():
    ...

# AC-8: max_total_bytes-Cap droppt unabhängig
@pytest.mark.skip(reason="AC-8")
def test_total_bytes_cap_drops_lowest_priority():
    ...

# AC-9: Unbekanntes Modell → DEFAULT_LIMITS → strip
@pytest.mark.skip(reason="AC-9")
def test_unknown_model_falls_back_to_default_and_strips_images():
    ...
```
</test_spec>

### Test-Datei: `lib/assistant/__tests__/assistant-context.test.tsx`

<test_spec>
```typescript
// AC-7: RENDER_SYSTEM_MESSAGE rendert inline System-Bubble
it.todo('AC-7: RENDER_SYSTEM_MESSAGE appends a system-typed message with slot-load-failed text')

it.todo('AC-7: RENDER_SYSTEM_MESSAGE preserves chronological order in messages list')

it.todo('AC-7: RENDER_SYSTEM_MESSAGE does not trigger toast side-effect (pure state mutation)')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-19-reference-slots-dto` | `SendMessageRequest.reference_slots`, `last_result_image_url`, `project_id` | Pydantic Fields | DTO-Validation aktiv (max 5, HttpUrl); Service liest die Felder direkt aus dem Request |
| `slice-19-reference-slots-dto` | Frontend Body-Builder `body.reference_slots` Modus-Gate | Hook-Logic | FE sendet Slots nur bei `img2img`; BE re-checkt defensive (AC-2) |
| `slice-20-chat-llm-limits-module` | `get_chat_llm_limits(model_id)`, `CHAT_LLM_LIMITS`, `DEFAULT_LIMITS` | Module-Level Helper + Konstanten | Import via `from app.agent.chat_llm_limits import get_chat_llm_limits`; Returnshape `{"max_images", "max_total_bytes", "vision"}` |
| `slice-14-fsm-state-extension` (transitiv) | `SessionStateDTO` (kein direkter Use, nur konsistente Stream-Pipeline) | Pydantic | -- |
| (existing codebase) | `AssistantService.stream_response` (`backend/app/services/assistant_service.py:117-185`) | Async Generator | Bestehende Methode; HumanMessage-Build wird intern erweitert; SSE-Yield-Pattern bleibt |
| (existing codebase) | `SlotLoadFailedPayload`-Wire-Contract | SSE-Event-Schema | Definiert in architecture.md Section 2; Backend muss `event: "slot-load-failed"` + `data: {slot_index, reason}` exakt so emittieren |
| (existing codebase) | `lib/assistant/assistant-context.tsx` Reducer | React Reducer | Bestehender Action-Union wird um `RENDER_SYSTEM_MESSAGE` erweitert; Pattern wie `RENDER_INTENT_SUMMARY` (Slice 15) |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Multimodal-HumanMessage-Pipeline | Service Internals | (terminal: kein direkter Konsument; Verhalten via SSE-Stream sichtbar) | `_build_human_message(request, vision_capable, limits) -> HumanMessage` (oder äquivalente private Methode) |
| SSE-Event `slot-load-failed` | SSE-Event-Stream | `slice-22-multimodal-indicator-ui` (lauscht passiv), Frontend SSE-Handler | `{event: "slot-load-failed", data: {slot_index: int, reason: "fetch_failed" \| "invalid_url"}}` |
| Reducer-Action `RENDER_SYSTEM_MESSAGE` | Reducer Action | `slice-22-multimodal-indicator-ui` (kann konsumieren), zukünftige Slices | `{type: "RENDER_SYSTEM_MESSAGE", payload: {slot_index: number, reason: string}}` → fügt System-Message in `messages`-Liste |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `backend/app/services/assistant_service.py` — Edit: HumanMessage-Build erweitern um Multimodal-Pipeline (Text + Chat-Uploads + ReferenceSlots img2img-only + last_result_image_url), Priority-Drop gegen `chat_llm_limits.max_images` + `max_total_bytes`, Vision-Fallback (strip alle Bilder bei `vision=False`), SSE-Emit `slot-load-failed` bei Slot-Fetch-Failure, defensive Re-Check `generation_mode == "img2img"` für Slots
- [ ] `lib/assistant/assistant-context.tsx` — Edit: Reducer-Action `RENDER_SYSTEM_MESSAGE` ergänzen (Action-Union + Reducer-Branch); fügt System-Typed-Message in `messages`-Array (chronologisch, kein Toast)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.
> **Hinweis:** Der SSE-Handler-Branch (`use-assistant-runtime.ts`), der den `slot-load-failed`-Event empfängt und `RENDER_SYSTEM_MESSAGE` dispatcht, wurde architektonisch in der Erweiterung des SSE-Switches verortet (architecture.md Zeile 528, Slice 15-Familie). Slice 21 stellt Action + Backend-Emit bereit; das Mounten des SSE-Branches gehört zur SSE-Handler-Erweiterung der Slice-Familie F (15) und ist hier nicht erneut Deliverable, da die Datei in Slice 15 schon angefasst wird. Sollte die Anbindung beim Vitest-Tests fehlen, MUSS Slice 21 die SSE-Handler-Branch-Zeile in `use-assistant-runtime.ts` als Mini-Edit nachziehen.

---

## Constraints

**Scope-Grenzen:**
- KEINE Veränderung der `SendMessageRequest`-DTO (gehört zu Slice 19).
- KEINE Konstanten-Definition für Caps (gehört zu Slice 20).
- KEINE UI-Komponente für Multimodal-Indicator (gehört zu Slice 22).
- KEINE neue SSE-Handler-Branch im Frontend für `slot-load-failed` (Bestandteil der SSE-Switch-Erweiterung in Slice 15-Familie); Slice 21 stellt nur die Reducer-Action bereit.
- KEIN Re-Upload der Slot-Bilder zum OpenRouter-Endpoint — Pass-Through der Presigned-URLs (architecture.md → Risk "Reference-slot URLs reachable by OpenRouter").
- KEINE Token-Counting-Heuristik (Multimodal-Budget basiert auf `max_images` + `max_total_bytes`, NICHT auf Token-Schätzung).

**Technische Constraints:**
- Drop-Order MUSS strikt der Priority-Tabelle in architecture.md → "Multimodal Pipeline — Priority Order & Budget" folgen (Prio 3 = Chat-Uploads zuerst droppen, dann Prio 2 = last_result, zuletzt Prio 1 = Refs).
- Bei mehreren gleichpriorisierten Items (z.B. mehrere Chat-Uploads) MUSS die "newest first"-Erhaltung-Order respektiert werden — älteste Items werden zuerst gedroppt.
- SSE-Event-Schema MUSS exakt `SlotLoadFailedPayload` aus architecture.md Section 2 entsprechen (`slot_index: int`, `reason: Literal["fetch_failed", "invalid_url"]`).
- Vision-Fallback ist SILENT (kein User-Error, nur WARNING-Log, architecture.md → "Vision fallback determinism").
- `get_chat_llm_limits(None)` und `get_chat_llm_limits("")` greifen Slice 20's Fail-Safe — kein Exception im Service.
- Reducer-Branch MUSS pure Function bleiben (keine Side-Effects, kein Toast-Trigger im Reducer); Toast-Suppression ist explizit in AC-7 verankert.

**Referenzen:**
- Architecture: `architecture.md` → Section "Multimodal Pipeline Architecture" (Sequenzdiagramm Zeilen 230-286).
- Architecture: `architecture.md` → Section "Multimodal Pipeline — Priority Order & Budget" (Drop-Reihenfolge + Cap-Source).
- Architecture: `architecture.md` → Section "Constraints & Trade-Offs" (Vision-Fallback + Modus-Gate Slot-Inclusion).
- Architecture: `architecture.md` → Section 2 Wire-Contracts → `SlotLoadFailedPayload` (SSE-Event-Schema).
- Architecture: `architecture.md` → "Error Handling" Tabelle (Missing/invalid reference-slot URL → Behaviour).
- Discovery: `discovery.md` → Q4 (Multimodal-Budget Caps) + Q6 (Enforcement-Location Backend).

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `backend/app/services/assistant_service.py` (`stream_response` 117-185) | EXTEND: HumanMessage-Bau erweitern; Streaming-Pipeline-Skelett bleibt unverändert |
| `backend/app/agent/chat_llm_limits.py` | IMPORT only: `get_chat_llm_limits(model_id)` — Slice 20 stellt Helper; nicht neu implementieren |
| `backend/app/models/dtos.py` (`SendMessageRequest`, `ReferenceSlotDTO`) | IMPORT only: DTO-Felder konsumieren (Slice 19); keine DTO-Änderung |
| `lib/assistant/assistant-context.tsx` (Reducer 104-252) | EXTEND: nur `RENDER_SYSTEM_MESSAGE`-Action ergänzen; bestehende Actions UNVERÄNDERT (Slice 15/17/18 Edits stehen) |
| `langchain_core.messages.HumanMessage` | IMPORT only: bestehender Import; Content-Liste mit Multipart-Struktur befüllen |
