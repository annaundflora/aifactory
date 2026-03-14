# Bug: Chat-Panel nicht in Detail-View eingebunden

**Entdeckt:** 2026-03-14
**Status:** 🔴 Neu
**Priority:** Hoch
**Location:** `components/workspace/workspace-content.tsx:142-153`

---

## Problembeschreibung

Das `CanvasChatPanel` (`components/canvas/canvas-chat-panel.tsx`) ist vollstaendig implementiert (Init-Message, Collapse/Expand, Resize, SSE-Streaming, Chip-Handling, New-Session), wird aber in `workspace-content.tsx` nicht importiert und nicht als `chatSlot` Prop an `CanvasDetailView` uebergeben.

`CanvasDetailView` hat einen optionalen `chatSlot?: ReactNode` Prop. Wenn dieser nicht gesetzt ist, rendert die Chat-Aside einen leeren Container (oder gar nichts Sichtbares).

## Reproduktion

1. Oeffne die Detail-View
2. Beobachte: Kein Chat-Panel rechts sichtbar
3. Chat-Toggle-Button im Header ist vorhanden, aber toggelt nur einen leeren Bereich

## Erwartetes Verhalten

- Chat-Panel rechts im Detail-View sichtbar
- Init-Message mit Bild-Kontext (Model, Prompt, Steps, CFG)
- Collapse/Expand, Resize, Nachrichtenversand funktionieren

## Tatsaechliches Verhalten

- Kein Chat-Panel sichtbar
- `CanvasChatPanel` wird nicht importiert in workspace-content.tsx
- `chatSlot` Prop wird nicht an `CanvasDetailView` uebergeben

## Test-Evidenz

- `Grep "CanvasChatPanel" workspace-content.tsx` → Kein Treffer
- Code `workspace-content.tsx:142-153`: CanvasDetailView wird ohne chatSlot gerendert:
  ```tsx
  <CanvasDetailView
    generation={selectedGeneration}
    allGenerations={completedGenerations}
    onBack={handleDetailViewClose}
  />
  ```
- `canvas-detail-view.tsx:456-460`: Chat-Aside rendert `{chatSlot}` was undefined ist

## Loesungsansatz

In `workspace-content.tsx`:
1. `CanvasChatPanel` importieren
2. Als `chatSlot` Prop uebergeben:
   ```tsx
   <CanvasDetailView
     generation={selectedGeneration}
     allGenerations={completedGenerations}
     onBack={handleDetailViewClose}
     chatSlot={
       <CanvasChatPanel
         generation={selectedGeneration}
         projectId={projectId}
       />
     }
   />
   ```

## Naechste Schritte

1. [ ] `CanvasChatPanel` in `workspace-content.tsx` importieren und als chatSlot uebergeben
2. [ ] Testen: Chat-Panel sichtbar, Init-Message korrekt, Collapse/Expand funktioniert
3. [ ] Backend-Verbindung testen (SSE-Streaming, canvas-generate Events)
