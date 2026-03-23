# Slice Decomposition

**Feature:** Model-Aware Prompt Knowledge System
**Discovery-Slices:** 5 (grobe Slices)
**Atomare Slices:** 13
**Stack:** TypeScript + Next.js (Frontend/Improver) + Python + FastAPI/LangGraph (Backend/Assistant/Canvas)

---

## Dependency Graph

```
slice-01 (Knowledge JSON)
    |
    +---> slice-02 (TS Lookup)
    |         |
    |         +---> slice-04 (Improver Service)
    |         |         |
    |         |         +---> slice-05 (Improver Durchreichung)
    |         |
    +---> slice-03 (Python Lookup)
    |         |
    |         +---> slice-06 (Assistant System-Prompt)
    |         |         |
    |         |         +---> slice-07 (Assistant DTO + Route)
    |         |         |         |
    |         |         |         +---> slice-08 (Assistant Frontend)
    |         |         |
    |         +---> slice-09 (Canvas Chat Injection)
    |         |
    |         +---> slice-10 (recommend_model Enhancement)
    |
    +---> slice-11 (Knowledge Inhalt: 8 Modelle)
              |
              (abhaengig von slice-01 Schema, parallel zu slice-02/03)

slice-12 (Integration-Test Improver) ---> slice-05
slice-13 (Integration-Test Assistant + Canvas) ---> slice-08, slice-09
```

---

## Slice-Liste

### Slice 01: Knowledge JSON Schema + Fallback-Skeleton

- **Scope:** Die Datei `data/prompt-knowledge.json` mit korrektem Schema erstellen. Enthaelt das `fallback`-Objekt und ein exemplarisches Modell (`flux-2`) als Vorlage. Definiert die TypeScript-Typen fuer das Knowledge-Schema.
- **Deliverables:**
  - `data/prompt-knowledge.json` (Skeleton mit fallback + 1 Modell)
  - `lib/types/prompt-knowledge.ts` (TypeScript-Interfaces: ModelKnowledge, ModeKnowledge, PromptKnowledgeFile)
- **Done-Signal:** JSON ist valide, TypeScript-Typen kompilieren fehlerfrei (`tsc --noEmit`)
- **Dependencies:** []
- **Discovery-Quelle:** Slice 1 "Knowledge-Datei + Lookup"

---

### Slice 02: TS Lookup-Funktion (Prefix-Matching)

- **Scope:** Lookup-Service in TypeScript: JSON laden (module-level cache), laengsten Prefix matchen, Modus-Sektion filtern, Fallback zurueckgeben. Reine Funktion ohne Side-Effects.
- **Deliverables:**
  - `lib/services/prompt-knowledge.ts` (getPromptKnowledge, formatKnowledgeForPrompt)
  - `lib/services/__tests__/prompt-knowledge.test.ts` (Unit-Tests)
- **Done-Signal:** Unit-Tests grueen: Prefix-Matching (exakt, laengster Match gewinnt), Fallback bei unbekanntem Modell, Modus-Filter (txt2img/img2img/undefined), Slash-Stripping (owner/model-name -> model-name)
- **Dependencies:** ["slice-01"]
- **Discovery-Quelle:** Slice 1 "Knowledge-Datei + Lookup"

---

### Slice 03: Python Lookup-Funktion (Prefix-Matching)

- **Scope:** Lookup-Modul in Python: JSON laden (module-level cache), laengsten Prefix matchen, Modus-Sektion filtern, Fallback zurueckgeben. Identische Logik wie TS-Version.
- **Deliverables:**
  - `backend/app/agent/prompt_knowledge.py` (get_prompt_knowledge, format_knowledge_for_prompt)
  - `backend/tests/test_prompt_knowledge.py` (Unit-Tests)
- **Done-Signal:** Unit-Tests grueen: Prefix-Matching (exakt, laengster Match gewinnt), Fallback bei unbekanntem Modell, Modus-Filter, Slash-Stripping. Identische Ergebnisse wie TS-Version fuer gleiche Inputs.
- **Dependencies:** ["slice-01"]
- **Discovery-Quelle:** Slice 1 "Knowledge-Datei + Lookup"

---

### Slice 04: Improver buildSystemPrompt + Knowledge-Injection

- **Scope:** `buildSystemPrompt()` in `prompt-service.ts` erweitern: statische Model-Hints (Zeilen 24-31) durch dynamischen Knowledge-Lookup ersetzen. Neuen Parameter `generationMode` hinzufuegen. `improve()` erhaelt ebenfalls `generationMode` und reicht ihn durch.
- **Deliverables:**
  - `lib/services/prompt-service.ts` (EXTEND: buildSystemPrompt + improve mit generationMode)
- **Done-Signal:** `buildSystemPrompt("black-forest-labs/flux-2-pro", "Flux 2 Pro", "txt2img")` gibt System-Prompt mit Flux-spezifischen Tipps zurueck (nicht die alten statischen Hints). Fallback-Fall: unbekanntes Modell -> generische Tipps.
- **Dependencies:** ["slice-02"]
- **Discovery-Quelle:** Slice 2 "Improver Knowledge-Injection"

---

### Slice 05: Improver generationMode Durchreichung (Action + UI)

- **Scope:** `generationMode` von der UI bis zum Service durchreichen: `LLMComparisonProps` erweitern, `improvePrompt` Server Action erweitern, `prompt-area.tsx` uebergibt `currentMode`.
- **Deliverables:**
  - `app/actions/prompts.ts` (EXTEND: generationMode Parameter in improvePrompt)
  - `components/prompt-improve/llm-comparison.tsx` (EXTEND: generationMode Prop, durchreichen an Action)
  - `components/workspace/prompt-area.tsx` (EXTEND: currentMode an LLMComparison uebergeben)
- **Done-Signal:** Improver-Aufruf mit einem Flux-Modell im img2img-Modus: Server Action erhaelt `generationMode="img2img"`, Service erhaelt den Wert, System-Prompt enthaelt img2img-spezifische Tipps.
- **Dependencies:** ["slice-04"]
- **Discovery-Quelle:** Slice 2 "Improver Knowledge-Injection"

---

### Slice 06: Assistant System-Prompt dynamisch machen

- **Scope:** `SYSTEM_PROMPT`-Konstante in `prompts.py` durch Funktion `build_assistant_system_prompt(image_model_id, generation_mode)` ersetzen. Knowledge-Sektion an den Base-Prompt anhaengen. `graph.py` anpassen: `_call_model_sync` und `_call_model_async` lesen `image_model_id` + `generation_mode` aus `config["configurable"]` und rufen die neue Funktion auf.
- **Deliverables:**
  - `backend/app/agent/prompts.py` (EXTEND: build_assistant_system_prompt Funktion)
  - `backend/app/agent/graph.py` (EXTEND: config-Werte lesen, neue Funktion aufrufen)
- **Done-Signal:** Unit-Test: `build_assistant_system_prompt("flux-2-pro", "txt2img")` gibt System-Prompt mit Flux-Wissen zurueck. `build_assistant_system_prompt(None, None)` gibt den bisherigen Base-Prompt ohne Knowledge-Sektion zurueck (Backward-Kompatibilitaet).
- **Dependencies:** ["slice-03"]
- **Discovery-Quelle:** Slice 3 "Assistant Knowledge-Injection"

---

### Slice 07: Assistant DTO + Route + Service (image_model_id, generation_mode)

- **Scope:** `SendMessageRequest` in `dtos.py` um optionale Felder `image_model_id` und `generation_mode` erweitern. `messages.py` Route reicht die neuen Felder an den Service weiter. `assistant_service.py` `stream_response` nimmt die neuen Parameter und setzt sie in `config["configurable"]`.
- **Deliverables:**
  - `backend/app/models/dtos.py` (EXTEND: SendMessageRequest + 2 optionale Felder)
  - `backend/app/routes/messages.py` (EXTEND: neue Felder durchreichen)
  - `backend/app/services/assistant_service.py` (EXTEND: stream_response Signatur + config)
- **Done-Signal:** POST `/sessions/{id}/messages` mit `{ "content": "test", "image_model_id": "flux-2-pro", "generation_mode": "txt2img" }` validiert fehlerfrei (200). Ohne die neuen Felder (Backward-Kompatibilitaet) ebenfalls 200.
- **Dependencies:** ["slice-06"]
- **Discovery-Quelle:** Slice 3 "Assistant Knowledge-Injection"

---

### Slice 08: Assistant Frontend (image_model_id + generation_mode senden)

- **Scope:** `sendMessageToSession` in `use-assistant-runtime.ts` erweitern: `image_model_id` und `generation_mode` aus dem Workspace-State lesen und im Request-Body mitsenden. `assistant-context.tsx` ggf. anpassen, um Workspace-State (modelId, currentMode) zugaenglich zu machen.
- **Deliverables:**
  - `lib/assistant/use-assistant-runtime.ts` (EXTEND: body um image_model_id + generation_mode)
  - `lib/assistant/assistant-context.tsx` (EXTEND: Workspace-State Zugriff, falls noetig)
- **Done-Signal:** Browser-DevTools: POST-Request an `/sessions/{id}/messages` enthaelt `image_model_id` und `generation_mode` im Body wenn ein Bildmodell und Modus im Workspace ausgewaehlt sind. Ohne Workspace-Kontext: Felder fehlen (Backward-Kompatibilitaet).
- **Dependencies:** ["slice-07"]
- **Discovery-Quelle:** Slice 3 "Assistant Knowledge-Injection"

---

### Slice 09: Canvas Chat Knowledge-Injection

- **Scope:** `build_canvas_system_prompt()` in `canvas_graph.py` erweitern: nach der context_section die Knowledge-Sektion fuer `model_id` aus `image_context` laden und als Prompting-Tipps-Block anhaengen.
- **Deliverables:**
  - `backend/app/agent/canvas_graph.py` (EXTEND: Knowledge-Lookup + Prompt-Anhaengung)
- **Done-Signal:** Unit-Test: `build_canvas_system_prompt({"model_id": "flux-2-pro", "image_url": "...", "prompt": "...", "model_params": {}})` gibt System-Prompt mit Flux-Prompting-Tipps zurueck. Ohne image_context: kein Crash, kein Knowledge-Block.
- **Dependencies:** ["slice-03"]
- **Discovery-Quelle:** Slice 4 "Canvas Chat Knowledge-Injection"

---

### Slice 10: recommend_model Knowledge-Enrichment

- **Scope:** `_match_model()` in `model_tools.py` erweitern: nach dem Match die `strengths` aus der Knowledge-Datei laden und in den `reason_de`-String einbauen. Praezisere Begruendungen statt generischer Saetze.
- **Deliverables:**
  - `backend/app/agent/tools/model_tools.py` (EXTEND: Knowledge-Import + Reason-Enrichment)
- **Done-Signal:** Unit-Test: `_match_model("product photography", ["photorealistic"], available_models)` gibt einen `reason` zurueck, der modellspezifische Staerken enthaelt (z.B. "Prompt-Treue und technische Fotografie" statt nur "fotorealistische Bilder mit hoher Detailtreue").
- **Dependencies:** ["slice-03"]
- **Discovery-Quelle:** Slice 5 "recommend_model Enhancement"

---

### Slice 11: Knowledge-Inhalt fuer alle 8 Modell-Familien

- **Scope:** `data/prompt-knowledge.json` mit vollstaendigem Inhalt fuer alle 9 Prefixe befuellen: flux-2, flux-schnell, nano-banana, gpt-image, seedream, stable-diffusion, recraft, ideogram, hunyuan. Basierend auf `specs/best-practices-prompting.md` und der Web-Recherche (Seedream, Nano Banana). Token-Budget einhalten (~200 Tokens pro Modell-Sektion).
- **Deliverables:**
  - `data/prompt-knowledge.json` (EXTEND: vollstaendiger Inhalt fuer alle Modelle)
- **Done-Signal:** JSON ist valide. Jeder der 9 Prefixe hat: displayName, promptStyle, negativePrompts, strengths (2-4), tips (3-6), avoid (2-4). Mindestens flux-2, seedream und nano-banana haben modes.txt2img und modes.img2img. Token-Count pro Modell-Sektion < 250 Tokens.
- **Dependencies:** ["slice-01"]
- **Discovery-Quelle:** Slice 1 "Knowledge-Datei + Lookup"

---

### Slice 12: Integration-Test Improver End-to-End

- **Scope:** Integration-Test der Improver-Kette: `improvePrompt` Action mit realem Knowledge-Lookup aufrufen, pruefen dass der System-Prompt modell- und modus-spezifisches Wissen enthaelt.
- **Deliverables:**
  - `lib/services/__tests__/prompt-service.integration.test.ts` (Integration-Test)
- **Done-Signal:** Test grueen: Improver mit Flux-Modell + img2img-Modus aufrufen -> System-Prompt enthaelt Flux-Tipps UND img2img-Tipps. Improver mit unbekanntem Modell -> System-Prompt enthaelt Fallback-Tipps.
- **Dependencies:** ["slice-05", "slice-11"]
- **Discovery-Quelle:** Slice 2 "Improver Knowledge-Injection"

---

### Slice 13: Integration-Test Assistant + Canvas Chat

- **Scope:** Integration-Tests fuer die Python-Seite: (1) Assistant build_assistant_system_prompt mit verschiedenen Modellen + Modi testen. (2) Canvas Chat build_canvas_system_prompt mit image_context testen. (3) recommend_model mit Knowledge-enriched Reasons testen.
- **Deliverables:**
  - `backend/tests/test_knowledge_integration.py` (Integration-Tests)
- **Done-Signal:** Tests grueen: (1) Assistant System-Prompt mit Flux-Modell enthaelt Flux-Tipps. (2) Canvas Chat System-Prompt mit Seedream-Modell enthaelt Seedream-Tipps. (3) recommend_model Reason enthaelt modellspezifische Staerken.
- **Dependencies:** ["slice-06", "slice-09", "slice-10", "slice-11"]
- **Discovery-Quelle:** Slice 3-5 "Assistant/Canvas/recommend_model"

---

## Flow-Traceability

| Discovery-Slice | Integration-Testfall | Abgedeckt in Slice | Done-Signal |
|-----------------|----------------------|--------------------|-------------|
| Slice 1 "Knowledge-Datei + Lookup" | Unit-Tests: Prefix-Matching, laengster Match, Fallback, Modus-Filter | slice-02 (TS), slice-03 (Python) | Unit-Tests grueen fuer beide Runtimes |
| Slice 2 "Improver Knowledge-Injection" | Improver mit Flux-Modell aufrufen: System-Prompt enthaelt Flux-Tipps | slice-04 (Service), slice-12 (Integration) | buildSystemPrompt gibt Flux-Tipps zurueck; Integration-Test verifiziert E2E |
| Slice 2 "Improver Knowledge-Injection" | Improver mit img2img-Modus: System-Prompt enthaelt img2img-Tipps | slice-05 (Durchreichung), slice-12 (Integration) | generationMode wird durchgereicht; Integration-Test prueft img2img-Tipps im Prompt |
| Slice 3 "Assistant Knowledge-Injection" | Assistant mit gewaehltem Flux-Modell: gibt Flux-spezifische Prompt-Tipps statt generischer | slice-06 (System-Prompt), slice-07 (DTO/Route), slice-08 (Frontend), slice-13 (Integration) | build_assistant_system_prompt mit Flux gibt Flux-Wissen; Frontend sendet image_model_id; Integration-Test verifiziert |
| Slice 4 "Canvas Chat Knowledge-Injection" | Canvas Chat auf Flux-generiertem Bild: Prompt-Verbesserungen nutzen Flux-Staerken | slice-09 (Canvas Injection), slice-13 (Integration) | build_canvas_system_prompt mit model_id gibt Prompting-Tipps; Integration-Test verifiziert |
| Slice 5 "recommend_model Enhancement" | recommend_model fuer "Product Photography": empfiehlt Flux mit spezifischer Begruendung | slice-10 (Enrichment), slice-13 (Integration) | _match_model gibt Knowledge-basierte Reason zurueck; Integration-Test verifiziert |

---

## Qualitaets-Checkliste

- [x] Jeder Slice hat maximal 3 produktive Deliverable-Dateien
- [x] Jeder Slice hat ein messbares Done-Signal
- [x] Dependencies sind azyklisch (DAG)
- [x] Alle Deliverables aus der Discovery sind abgedeckt (nichts vergessen)
- [x] Kein Slice hat mehr als ein Concern (DB+UI = zu viel)
- [x] Schema/Service-Slices kommen vor UI-Slices
- [x] Stack ist korrekt erkannt und dokumentiert
- [x] Flow-Completeness: Jeder Integration-Testfall aus Discovery-Testability hat einen zugehoerigen Slice mit passendem Done-Signal
