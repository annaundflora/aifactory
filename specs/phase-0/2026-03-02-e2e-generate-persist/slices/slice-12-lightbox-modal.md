# Slice 12: Lightbox Modal

> **Slice 12 von 21** fuer `E2E Generate & Persist`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-12-lightbox-modal` |
| **Test** | `pnpm test components/lightbox/__tests__/lightbox-modal.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-11-gallery-grid-generation-cards"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/lightbox/__tests__/lightbox-modal.test.tsx` |
| **Integration Command** | -- |
| **Acceptance Command** | -- |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `localhost:3000` |
| **Mocking Strategy** | `mock_external` (Generation-Daten als Props gemockt, kein DB-Zugriff in Tests) |

---

## Ziel

Lightbox-Modal implementieren, das beim Klick auf ein Galerie-Bild ein grosses Bild zentriert mit Detail-Panel (Prompt, Negativ-Prompt, Modell, Parameter, Bildabmessungen, Erstelldatum) anzeigt. Das Modal laesst sich via X-Button oder Klick auf den Overlay-Hintergrund schliessen.

---

## Acceptance Criteria

1) GIVEN eine Liste von completed Generierungen und eine ausgewaehlte Generation mit `image_url`, `prompt`, `model_id`, `model_params`, `width`, `height`, `created_at`
   WHEN `<LightboxModal>` mit dieser Generation geoeffnet wird
   THEN wird das Bild gross und zentriert im Modal angezeigt mit der `image_url` als Source

2) GIVEN eine geoeffnete `<LightboxModal>` mit einer Generation
   WHEN das Detail-Panel gerendert wird
   THEN werden folgende Felder angezeigt: Prompt (vollstaendig), Modell-Name, Parameter (aus `model_params`), Bildabmessungen (`width x height`), Erstelldatum (formatiert)

3) GIVEN eine Generation mit `negative_prompt: "blurry, low quality"`
   WHEN `<LightboxModal>` diese Generation anzeigt
   THEN wird das Negativ-Prompt-Feld mit dem Wert "blurry, low quality" im Detail-Panel angezeigt

4) GIVEN eine Generation mit `negative_prompt: null`
   WHEN `<LightboxModal>` diese Generation anzeigt
   THEN wird das Negativ-Prompt-Feld NICHT im Detail-Panel gerendert

5) GIVEN eine geoeffnete `<LightboxModal>`
   WHEN der User auf den X-Button klickt
   THEN wird ein `onClose` Callback aufgerufen und das Modal schliesst sich

6) GIVEN eine geoeffnete `<LightboxModal>`
   WHEN der User auf den gedimmten Overlay-Hintergrund klickt
   THEN wird ein `onClose` Callback aufgerufen und das Modal schliesst sich

7) GIVEN eine geoeffnete `<LightboxModal>`
   WHEN der User auf das Bild oder das Detail-Panel klickt
   THEN schliesst sich das Modal NICHT (kein Event-Bubbling zum Overlay)

8) GIVEN eine geoeffnete `<LightboxModal>`
   WHEN der User die Escape-Taste drueckt
   THEN wird ein `onClose` Callback aufgerufen und das Modal schliesst sich

9) GIVEN `<LightboxModal>` mit `isOpen: false`
   WHEN die Komponente gerendert wird
   THEN wird kein Modal im DOM angezeigt

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/lightbox/__tests__/lightbox-modal.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('LightboxModal', () => {
  // AC-1: Grosses Bild zentriert
  it.todo('should render large centered image with image_url as source')

  // AC-2: Detail-Panel mit allen Feldern
  it.todo('should display prompt, model name, parameters, dimensions, and created date')

  // AC-3: Negativ-Prompt angezeigt
  it.todo('should show negative prompt when present')

  // AC-4: Negativ-Prompt ausgeblendet
  it.todo('should not render negative prompt field when value is null')

  // AC-5: Schliessen via X-Button
  it.todo('should call onClose when X button is clicked')

  // AC-6: Schliessen via Overlay-Klick
  it.todo('should call onClose when overlay background is clicked')

  // AC-7: Kein Schliessen bei Klick auf Content
  it.todo('should not close when clicking on image or detail panel')

  // AC-8: Schliessen via Escape-Taste
  it.todo('should call onClose when Escape key is pressed')

  // AC-9: Nicht gerendert wenn geschlossen
  it.todo('should not render modal when isOpen is false')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-11` | `GalleryGrid.onSelectGeneration` | Callback | Liefert Generation-ID bei Klick auf Card |
| `slice-02` | `Generation` | Type | Generation-Entity mit `id`, `prompt`, `negative_prompt`, `model_id`, `model_params`, `image_url`, `width`, `height`, `created_at` aus `lib/db/schema.ts` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `LightboxModal` | React Component | slice-13 (Navigation), slice-15 (Download), slice-16 (Delete) | `<LightboxModal generation={Generation} isOpen={boolean} onClose={() => void} />` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/lightbox/lightbox-modal.tsx` -- Lightbox Modal mit grossem Bild, Detail-Panel, Overlay-Schliessen, X-Button, Escape-Handling
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Prev/Next Navigation -- kommt in Slice 13
- KEINE Download-Funktionalitaet -- kommt in Slice 15
- KEINE Delete-Funktionalitaet -- kommt in Slice 16
- KEINE Variation-Funktionalitaet -- kommt in spaeterem Slice
- KEINE Aktions-Buttons (Download, Variation, Delete) -- nur Detail-Anzeige und Schliessen

**Technische Constraints:**
- Client Component (`"use client"`) -- benoetigt onClick-Handler, Keyboard-Events, Portal-Rendering
- Overlay mit gedimmtem Hintergrund (z.B. `bg-black/80`)
- Event-Propagation via `stopPropagation` auf dem Modal-Content verhindern
- Escape-Taste via `useEffect` + `keydown` Event-Listener
- Body-Scroll sperren wenn Modal offen ist

**Referenzen:**
- Architecture: `architecture.md` -> Section "Project Structure" (Pfad `components/lightbox/`)
- Wireframes: `wireframes.md` -> Section "Screen: Lightbox / Image Detail Modal" (Annotationen 1, 4, 5, 6)
- Wireframes: `wireframes.md` -> Section "State Variations" (`no-negative-prompt`)
- Discovery: `discovery.md` -> Section "UI Components & States" (`lightbox-modal`)
- Discovery: `discovery.md` -> Section "User Flow" -> Flow 4 (Lightbox oeffnen)
