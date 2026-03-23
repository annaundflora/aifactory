# Slice 8: Assistant Frontend (image_model_id + generation_mode senden)

> **Slice 8 von 13** fuer `Model-Aware Prompt Knowledge System`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-08-assistant-frontend` |
| **Test** | `pnpm vitest run lib/assistant/__tests__/use-assistant-runtime-knowledge.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-07-assistant-dto"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm vitest run lib/assistant/__tests__/use-assistant-runtime-knowledge.test.ts` |
| **Integration Command** | -- |
| **Acceptance Command** | `pnpm tsc --noEmit` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (fetch gemockt, kein Backend noetig) |

---

## Ziel

Die Frontend-Seite der Assistant-Message-Pipeline erweitern, sodass `image_model_id` und `generation_mode` aus dem aktuellen Workspace-State gelesen und im POST-Body an `/sessions/{id}/messages` mitgesendet werden. Das Backend (Slice 07) erwartet diese optionalen Felder bereits. Ohne Workspace-Kontext (kein Modell/Modus ausgewaehlt) fehlen die Felder — Backward-Kompatibilitaet bleibt gewahrt.

---

## Acceptance Criteria

1) GIVEN ein Workspace mit ausgewaehltem Bildmodell `"black-forest-labs/flux-2-pro"` und Modus `"txt2img"`
   WHEN der User eine Nachricht im Assistant sendet
   THEN enthaelt der POST-Body an `/api/assistant/sessions/{id}/messages` die Felder `image_model_id: "black-forest-labs/flux-2-pro"` und `generation_mode: "txt2img"` neben den bestehenden Feldern (`content`, `model`)

2) GIVEN ein Workspace mit Bildmodell `"google/seedream-5"` und Modus `"img2img"`
   WHEN der User eine Nachricht sendet
   THEN enthaelt der POST-Body `image_model_id: "google/seedream-5"` und `generation_mode: "img2img"`

3) GIVEN kein Workspace-Kontext verfuegbar (z.B. `variationData` ist `null` oder `modelId` ist leer)
   WHEN der User eine Nachricht sendet
   THEN enthaelt der POST-Body KEINE Felder `image_model_id` und `generation_mode` (Backward-Kompatibilitaet, identisch mit pre-Slice-08 Verhalten)

4) GIVEN der Workspace-Modus ist `"upscale"` (kein txt2img/img2img)
   WHEN der User eine Nachricht sendet
   THEN wird `generation_mode` NICHT mitgesendet (nur `image_model_id` wenn vorhanden), weil das Backend nur `"txt2img"` und `"img2img"` als Literal akzeptiert

5) GIVEN der User wechselt das Bildmodell im Workspace von `"flux-2-pro"` zu `"seedream-5"` waehrend einer laufenden Assistant-Session
   WHEN der User die naechste Nachricht sendet
   THEN enthaelt der POST-Body das AKTUELLE Modell `image_model_id: "google/seedream-5"` (nicht das vorherige)

6) GIVEN `assistant-context.tsx` nutzt bereits `useWorkspaceVariation` (Zeile 16/342)
   WHEN der Workspace `variationData.modelId` einen Wert hat
   THEN ist dieser Wert fuer `sendMessageToSession` als `image_model_id` zugaenglich (bestehender Import wird wiederverwendet, KEIN neuer Context noetig)

7) GIVEN `currentMode` (GenerationMode) lebt in `prompt-area.tsx` (Zeile 134) und ist NICHT im workspace-state Context
   WHEN `assistant-context.tsx` den aktuellen Modus fuer `generation_mode` benoetigt
   THEN wird der Modus ueber einen geeigneten Mechanismus zugaenglich gemacht (z.B. Prop, Ref-Forwarding, oder workspace-state Erweiterung) — die bestehende Signatur `sendMessage(content, imageUrls?)` aendert sich NICHT

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/assistant/__tests__/use-assistant-runtime-knowledge.test.ts`

<test_spec>
```typescript
import { describe, it } from "vitest";

describe("sendMessageToSession with image_model_id + generation_mode", () => {
  // AC-1: POST-Body enthaelt image_model_id + generation_mode bei aktivem Workspace
  it.todo("should include image_model_id and generation_mode in POST body when workspace has model and mode");

  // AC-2: POST-Body enthaelt korrekte Werte fuer img2img Modus
  it.todo("should send generation_mode img2img when workspace mode is img2img");

  // AC-3: Keine neuen Felder ohne Workspace-Kontext (Backward-Kompatibilitaet)
  it.todo("should not include image_model_id or generation_mode when no workspace context");

  // AC-4: generation_mode wird nicht gesendet bei upscale Modus
  it.todo("should omit generation_mode when workspace mode is upscale");

  // AC-5: Aktuelles Modell wird gesendet (nicht cached/stale)
  it.todo("should send current model id after workspace model change");

  // AC-6: modelId aus variationData ist zugaenglich
  it.todo("should read modelId from workspace variationData");

  // AC-7: currentMode wird ueber den gewaehlten Mechanismus zugaenglich
  it.todo("should access currentMode for generation_mode field");
});
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| slice-07-assistant-dto | `SendMessageRequest.image_model_id` | DTO Field (Optional[str]) | Backend akzeptiert das Feld im POST-Body |
| slice-07-assistant-dto | `SendMessageRequest.generation_mode` | DTO Field (Optional[Literal["txt2img", "img2img"]]) | Backend akzeptiert das Feld im POST-Body |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `image_model_id` im POST-Body | Request Field | slice-13 (Integration-Test) | Feld im fetch-Body von `sendMessageToSession` |
| `generation_mode` im POST-Body | Request Field | slice-13 (Integration-Test) | Feld im fetch-Body von `sendMessageToSession` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/assistant/use-assistant-runtime.ts` (MODIFY) -- `sendMessageToSession` Body-Objekt um `image_model_id` und `generation_mode` erweitern; Werte aus Workspace-State/Refs lesen
- [ ] `lib/assistant/assistant-context.tsx` (MODIFY) -- Workspace `modelId` und `currentMode` fuer `useAssistantRuntime` zugaenglich machen (z.B. ueber Refs oder Options-Erweiterung)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEIN Aendern von Backend-Dateien (Slice 07)
- KEIN Aendern der oeffentlichen `sendMessage(content, imageUrls?)` Signatur im Context
- KEINE neuen UI-Komponenten oder sichtbaren Aenderungen
- KEINE neuen npm-Dependencies
- KEIN Aendern von `prompt-area.tsx` (die Workspace-UI bleibt unveraendert)

**Technische Constraints:**
- `image_model_id` wird nur gesendet wenn `variationData?.modelId` truthy ist — sonst Feld weglassen (nicht `null` senden)
- `generation_mode` wird nur gesendet wenn der Modus `"txt2img"` oder `"img2img"` ist — `"upscale"`, `"inpaint"`, `"outpaint"` werden NICHT gesendet (Backend-Literal laesst nur txt2img/img2img zu)
- `useAssistantRuntime` nutzt bereits ein Ref-Pattern fuer `selectedModel` (Zeile 126-127) — dasselbe Pattern fuer `image_model_id` und `generation_mode` verwenden
- `assistant-context.tsx` importiert bereits `useWorkspaceVariation` (Zeile 16) und hat Zugriff auf `variationData.modelId` — diesen bestehenden Import wiederverwenden
- `currentMode` Problem: Der Modus lebt in `prompt-area.tsx` als lokaler State, NICHT im workspace-state. Der Implementer muss einen Weg finden, den aktuellen Modus zum Assistant-Context durchzureichen. Optionen laut architecture.md Risk-Section: (A) Prop an Provider, (B) workspace-state erweitern, (C) Ref-Forwarding. Die einfachste Loesung waehlen, die keine Aenderung an `prompt-area.tsx` erfordert. Fallback: `variationData.targetMode` NICHT verwenden — es ist nur ein transienter Trigger, kein persistenter Wert.

**Referenzen:**
- Architecture: `architecture.md` -- Section "Migration Map" (Zeilen 229-230: use-assistant-runtime.ts, assistant-context.tsx)
- Architecture: `architecture.md` -- Section "Business Logic Flow > [Assistant]" (Zeilen 112-121)
- Architecture: `architecture.md` -- Section "Risks" (Zeile 294: Workspace-State Zugriff)
- Architecture: `architecture.md` -- Section "Assumptions" (Zeile 294: Frontend workspace access)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `lib/assistant/use-assistant-runtime.ts` | MODIFY: `sendMessageToSession` Body-Objekt erweitern (Zeile 352-358). Ref-Pattern von `selectedModelRef` (Zeile 126) wiederverwenden fuer Workspace-Werte |
| `lib/assistant/assistant-context.tsx` | MODIFY: Bestehenden `useWorkspaceVariation` Import (Zeile 16) und `variationData` (Zeile 342) nutzen. Workspace-Werte an Runtime-Hook durchreichen |
| `lib/workspace-state.tsx` | Import, unveraendert — `WorkspaceVariationState.modelId` ist die Quelle fuer `image_model_id` |
