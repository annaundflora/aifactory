"use client";

import { useWorkspaceVariation } from "@/lib/workspace-state";
import { usePromptAssistant } from "@/lib/assistant/assistant-context";

// ---------------------------------------------------------------------------
// Slice 22: Multimodal-Indicator UI
// ---------------------------------------------------------------------------
// Eine schlanke Indicator-Komponente unter dem ChatInput, die genau das
// rendert, was der Assistant aktuell „sieht" — aktive Refs (img2img-Modus
// only) plus das letzte erfolgreich generierte Result-Image. Sie versteckt
// sich, wenn nichts Multimodales angehängt ist und zeigt „Sieht: nur Text"
// bei Non-Vision-Modellen, deren Bilder im Backend gestrippt werden.
//
// Die Komponente nimmt KEINE Props entgegen — alle Daten kommen über zwei
// Provider:
//   - useWorkspaceVariation()  → referenceSlots + generationMode (Slot-Quelle
//                                ist reaktiv, daher Re-Render bei Change;
//                                NICHT der Slot-Ref aus Slice 19, der ist
//                                bewusst non-reaktiv)
//   - usePromptAssistant()     → state.lastResultImageUrl + selectedModel
//                                (Reducer-State → Re-Render-Trigger)
// ---------------------------------------------------------------------------

/**
 * Frontend-Mirror der Backend-`vision`-Flags aus
 * `backend/app/agent/chat_llm_limits.py`.
 *
 * Die kanonische Quelle der Wahrheit lebt im Backend: dort werden bei
 * `vision: False` ALLE Image-Parts vor dem LLM-Call gestrippt (siehe
 * architecture.md → "Vision-model fallback"). Dieser Mirror existiert
 * NUR damit der Indicator dem Nutzer transparent zeigen kann, dass die
 * Anhänge im Backend wegfallen werden („Sieht: nur Text").
 *
 * Aktuelle Allowlist (Stand Slice 20) ist komplett vision-fähig — das
 * Set bleibt absichtlich leer und wird bei künftigen Modell-Erweiterungen
 * hier ergänzt. Default ist „vision-fähig"; nur explizit gelistete IDs
 * werden als Non-Vision behandelt (sicherer Default).
 */
const NON_VISION_CHAT_MODELS: ReadonlySet<string> = new Set<string>([
  // Future non-vision OpenRouter chat-LLMs go here. Mirrors the
  // ``vision: False`` entries in ``CHAT_LLM_LIMITS`` (chat_llm_limits.py).
]);

function isVisionCapableModel(modelId: string | null | undefined): boolean {
  if (!modelId) return true; // Defensive default — match backend's per-id lookup
  return !NON_VISION_CHAT_MODELS.has(modelId);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MultimodalIndicator() {
  const { referenceSlots, generationMode } = useWorkspaceVariation();
  const { lastResultImageUrl, selectedModel } = usePromptAssistant();

  // Slice 21 Modus-Gate spiegeln: Refs zählen NUR im img2img-Modus. In
  // txt2img / upscale werden Slots backend-seitig ignoriert; der Indicator
  // muss das gleiche Gate auf der UI-Seite anwenden, sonst lügt er.
  const refSlotsArray = referenceSlots ?? [];
  const filledRefs =
    generationMode === "img2img"
      ? refSlotsArray.filter((s) => s.imageUrl)
      : [];
  const refCount = filledRefs.length;

  const hasResult = Boolean(lastResultImageUrl);
  const hasAnyAttachment = refCount > 0 || hasResult;

  // AC-4: Nichts anhängbar → Komponente rendert nichts.
  if (!hasAnyAttachment) {
    return null;
  }

  // AC-5: Non-Vision-Modell → Backend strippt Bilder; UI zeigt das transparent.
  const isVision = isVisionCapableModel(selectedModel);
  if (!isVision) {
    return (
      <div
        data-testid="multimodal-indicator"
        className="px-4 pb-2 text-xs text-muted-foreground"
      >
        Sieht: nur Text
      </div>
    );
  }

  // AC-1 / AC-2 / AC-3 / AC-6: Text-Komposition aus Refs + Result.
  let label: string;
  if (refCount > 0 && hasResult) {
    // AC-2: Refs + letztes Ergebnis kombiniert
    label =
      refCount === 1
        ? "Sieht: 1 Ref + letztes Ergebnis"
        : `Sieht: ${refCount} Refs + letztes Ergebnis`;
  } else if (refCount > 0) {
    // AC-1 / AC-6: nur Refs (Singular/Plural)
    label = refCount === 1 ? "Sieht: 1 Ref" : `Sieht: ${refCount} Refs`;
  } else {
    // AC-3: nur letztes Ergebnis (kein Ref-Count)
    label = "Sieht: letztes Ergebnis";
  }

  return (
    <div
      data-testid="multimodal-indicator"
      className="px-4 pb-2 text-xs text-muted-foreground"
    >
      {label}
    </div>
  );
}
