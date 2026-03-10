# Slice 17: Lightbox — Cross-Mode Buttons (img2img + Upscale Popover)

> **Slice 17 von N** für `Multi-Mode Generation (img2img + Upscale)`

---

## Metadata (für Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-17-lightbox-cross-mode-buttons` |
| **Test** | `pnpm test components/lightbox/__tests__/lightbox-modal.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-09-action-generate-upscale", "slice-10-workspace-state-extension"]` |

---

## Test-Strategy (für Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/lightbox/__tests__/lightbox-modal.test.tsx` |
| **Integration Command** | `pnpm test components/lightbox/__tests__/` |
| **Acceptance Command** | — |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (vi.mock für `upscaleImage`-Action und `useWorkspaceVariation`-Hook) |

---

## Ziel

`lightbox-modal.tsx` wird um zwei neue Aktionsbuttons erweitert: "img2img" (setzt WorkspaceState und schließt Lightbox) und "Upscale" (öffnet Shadcn-Popover mit 2x/4x-Auswahl, ruft `upscaleImage`-Action auf). Die Button-Sichtbarkeit ist modus-abhängig. Die Variation-Button-Logik wird für img2img-Bilder angepasst. Shadcn Popover wird über `npx shadcn@latest add popover` installiert.

---

## Acceptance Criteria

1) GIVEN eine Lightbox ist geöffnet mit einem Bild der `generationMode: "txt2img"`
   WHEN die Aktionsleiste gerendert wird
   THEN sind sowohl der "img2img"-Button als auch der "Upscale"-Button sichtbar; der "Variation"-Button ist ebenfalls sichtbar

2) GIVEN eine Lightbox ist geöffnet mit einem Bild der `generationMode: "img2img"`
   WHEN die Aktionsleiste gerendert wird
   THEN sind "img2img"-Button, "Upscale"-Button und "Variation"-Button sichtbar

3) GIVEN eine Lightbox ist geöffnet mit einem Bild der `generationMode: "upscale"`
   WHEN die Aktionsleiste gerendert wird
   THEN sind "Upscale"-Button und "Variation"-Button **nicht** sichtbar; "img2img"-Button und übrige Buttons (Download, Fav, Delete) sind sichtbar

4) GIVEN ein txt2img-Bild ist in der Lightbox geöffnet und der "img2img"-Button wird geklickt
   WHEN der Click-Handler ausgeführt wird
   THEN wird `setVariation` mit `{ targetMode: "img2img", sourceImageUrl: <imageUrl des Bildes>, ...restliche Felder des Bildes }` aufgerufen und die Lightbox wird geschlossen (onClose)

5) GIVEN der "Upscale"-Button wird geklickt
   WHEN der Popover öffnet
   THEN zeigt er zwei Optionen: "2x" und "4x" — kein direkter Action-Aufruf beim Öffnen

6) GIVEN der Popover ist offen und "2x" wird geklickt
   WHEN der Click-Handler ausgeführt wird
   THEN wird `upscaleImage` mit `{ projectId, sourceImageUrl: <imageUrl des Bildes>, scale: 2, sourceGenerationId: <id des Bildes> }` aufgerufen; der Popover schließt sich; ein Toast "Upscaling..." erscheint

7) GIVEN der Popover ist offen und "4x" wird geklickt
   WHEN der Click-Handler ausgeführt wird
   THEN wird `upscaleImage` mit `{ projectId, sourceImageUrl: <imageUrl des Bildes>, scale: 4, sourceGenerationId: <id des Bildes> }` aufgerufen; der Popover schließt sich; ein Toast "Upscaling..." erscheint

8) GIVEN `upscaleImage` gibt `{ error: "..." }` zurück
   WHEN der Fehler empfangen wird
   THEN wird ein Fehler-Toast mit dem Error-Text angezeigt; die Lightbox bleibt geöffnet

9) GIVEN ein img2img-Bild ist in der Lightbox geöffnet und der "Variation"-Button wird geklickt
   WHEN der Click-Handler ausgeführt wird
   THEN wird `setVariation` mit `sourceImageUrl` aus dem `sourceImageUrl`-Feld des Bildes (nicht der `imageUrl`) und `targetMode: "img2img"` aufgerufen

10) GIVEN ein txt2img-Bild ist in der Lightbox geöffnet und der "Variation"-Button wird geklickt
    WHEN der Click-Handler ausgeführt wird
    THEN wird `setVariation` mit dem bestehenden Verhalten aufgerufen — `sourceImageUrl` bleibt undefined (unverändertes Verhalten)

---

## Test Skeletons

> **Für den Test-Writer-Agent:** Jedes Skeleton referenziert ein AC. `upscaleImage` via `vi.mock('@/app/actions/generations')` mocken. `useWorkspaceVariation` via `vi.mock('@/lib/workspace-state')` mocken. Bestehende Test-Patterns in `components/lightbox/__tests__/` übernehmen.

### Test-Datei: `components/lightbox/__tests__/lightbox-modal.test.tsx`

<test_spec>
```typescript
// AC-1: txt2img-Bild → img2img + Upscale + Variation sichtbar
it.todo('should show img2img, Upscale and Variation buttons for txt2img generation')

// AC-2: img2img-Bild → alle drei Buttons sichtbar
it.todo('should show img2img, Upscale and Variation buttons for img2img generation')

// AC-3: upscale-Bild → Upscale + Variation ausgeblendet, img2img sichtbar
it.todo('should hide Upscale and Variation buttons for upscale generation')

// AC-4: img2img-Button-Click → setVariation mit targetMode img2img + sourceImageUrl + onClose
it.todo('should call setVariation with targetMode img2img and imageUrl as sourceImageUrl on img2img button click')

// AC-5: Upscale-Button-Click → Popover mit 2x und 4x sichtbar
it.todo('should show popover with 2x and 4x options when Upscale button is clicked')

// AC-6: Popover 2x geklickt → upscaleImage mit scale 2 + Toast
it.todo('should call upscaleImage with scale 2 and show toast when 2x is selected')

// AC-7: Popover 4x geklickt → upscaleImage mit scale 4 + Toast
it.todo('should call upscaleImage with scale 4 and show toast when 4x is selected')

// AC-8: upscaleImage gibt error zurück → Fehler-Toast, Lightbox bleibt offen
it.todo('should show error toast and keep lightbox open when upscaleImage returns error')

// AC-9: Variation auf img2img-Bild → setVariation mit sourceImageUrl aus Bild-sourceImageUrl
it.todo('should call setVariation with sourceImageUrl from generation sourceImageUrl for img2img variation')

// AC-10: Variation auf txt2img-Bild → bestehendes Verhalten ohne sourceImageUrl
it.todo('should call setVariation without sourceImageUrl for txt2img variation')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-09-action-generate-upscale` | `upscaleImage` | Server Action | Signatur `({ projectId, sourceImageUrl, scale: 2\|4, sourceGenerationId? }) => Promise<Generation \| { error: string }>` |
| `slice-10-workspace-state-extension` | `useWorkspaceVariation` / `setVariation` | Hook | Akzeptiert `targetMode?: string`, `sourceImageUrl?: string` in `WorkspaceVariationState` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `lightbox-modal.tsx` (erweitert) | Component | Keine nachfolgenden Slices | Abgeschlossene Lightbox-Integration |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/lightbox/lightbox-modal.tsx` — "img2img"-Button und "Upscale"-Button (Shadcn Popover mit 2x/4x) hinzufügen; modus-abhängige Sichtbarkeit; Variation-Logik für img2img anpassen; Shadcn Popover via `npx shadcn@latest add popover` installieren
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehören NICHT in Deliverables. Der Test-Writer-Agent erstellt `components/lightbox/__tests__/lightbox-modal.test.tsx` basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Keine Änderungen an anderen Lightbox-Sub-Komponenten (Details-Panel, Navigation)
- Kein neuer State in WorkspaceState — `setVariation` wird nur aufgerufen, nie erweitert
- Kein URL-Upload der sourceImage — `imageUrl` (R2-URL) wird direkt als `sourceImageUrl` übergeben
- Upscale-Mode-Prompt-Komposition liegt im Service (Slice 09), nicht hier

**Technische Constraints:**
- Shadcn Popover installieren: `npx shadcn@latest add popover`
- Toast via Sonner (`toast()` aus `sonner`) — bestehende Import-Pattern übernehmen
- Modus-Sichtbarkeit via `generation.generationMode`-Feld: `"upscale"` → Upscale + Variation ausblenden
- `setVariation` + `onClose` für img2img-Button: beides synchron im selben Handler aufrufen
- Popover schließen nach Scale-Auswahl: lokalen `open`-State nutzen

**Referenzen:**
- Button-Layout und Modus-Sichtbarkeit: `wireframes.md` → Section "Screen: Lightbox — Extended Actions → State Variations"
- Cross-Mode Lightbox-Verhalten: `architecture.md` → Section "State Persistence Matrix (Mode Switch)" letzter Absatz
- img2img-Variation mit original sourceImage: `wireframes.md` → Section "Wireframe — img2img Image Open (Variation differs)"
- Upscale Popover UI: `wireframes.md` → Section "Wireframe — Upscale Popover Open"
