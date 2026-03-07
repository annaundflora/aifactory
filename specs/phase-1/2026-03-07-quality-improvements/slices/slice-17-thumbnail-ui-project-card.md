# Slice 17: Thumbnail UI -- Project Card

> **Slice 17 von 21** fuer `quality-improvements`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-17-thumbnail-ui-project-card` |
| **Test** | `pnpm vitest run components/__tests__/project-card.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-16-thumbnail-service"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm vitest run components/__tests__/project-card.test.tsx` |
| **Integration Command** | `--` |
| **Acceptance Command** | `--` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `--` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Project Card um Thumbnail-Anzeige erweitern: generiertes Bild statt grauem Platzhalter, Loading-State mit Pulse-Animation, Fallback bei Fehler. Hover-Button fuer Thumbnail-Refresh hinzufuegen. In der `createProject` Action die Thumbnail-Generierung fire-and-forget ausloesen.

---

## Acceptance Criteria

1. GIVEN ein Projekt mit `thumbnailStatus = 'completed'` und einer `thumbnailUrl`
   WHEN die Project Card gerendert wird
   THEN wird ein `<img>` (Next.js `Image`) mit der `thumbnailUrl` als `src` im Thumbnail-Bereich (h-40) angezeigt, mit `object-cover` und `alt="{project.name} thumbnail"`

2. GIVEN ein Projekt mit `thumbnailStatus = 'pending'`
   WHEN die Project Card gerendert wird
   THEN wird im Thumbnail-Bereich eine Pulse-Animation (CSS `animate-pulse` auf dem `bg-muted`-Container) angezeigt statt des statischen Platzhalters

3. GIVEN ein Projekt mit `thumbnailStatus = 'none'` oder `thumbnailStatus = 'failed'`
   WHEN die Project Card gerendert wird
   THEN wird der bestehende Platzhalter angezeigt (grauer Hintergrund mit `ImageIcon`)

4. GIVEN die Project Card im Hover-State
   WHEN der User ueber die Karte hovert
   THEN wird neben den bestehenden Edit/Delete-Buttons ein Thumbnail-Refresh-Button (mit `RefreshCw`-Icon) sichtbar, mit `data-action="refresh-thumbnail"`

5. GIVEN der User klickt den Thumbnail-Refresh-Button
   WHEN der Klick verarbeitet wird
   THEN wird die `onRefreshThumbnail`-Callback-Prop mit der `project.id` aufgerufen, Navigation wird verhindert (`preventDefault`, `stopPropagation`)

6. GIVEN der Thumbnail-Refresh laeuft (`isRefreshing = true`)
   WHEN die Project Card gerendert wird
   THEN dreht sich das `RefreshCw`-Icon (CSS `animate-spin`) und der Button ist disabled

7. GIVEN ein User erstellt ein neues Projekt via `createProject` Action
   WHEN die Action erfolgreich das Projekt in der DB anlegt
   THEN wird `generateForProject(project.id)` aus dem Thumbnail-Service fire-and-forget aufgerufen (kein `await`, Fehler werden nicht propagiert)

8. GIVEN die `ProjectCardProject`-Interface
   WHEN sie definiert wird
   THEN enthaelt sie die optionalen Felder `thumbnailUrl?: string | null` und `thumbnailStatus?: string` (rueckwaertskompatibel)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/__tests__/project-card.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ProjectCard - Thumbnail UI', () => {
  // AC-1: Thumbnail-Bild anzeigen bei completed
  it.todo('should render Next.js Image with thumbnailUrl when thumbnailStatus is completed')

  // AC-2: Pulse-Animation bei pending
  it.todo('should render pulse animation when thumbnailStatus is pending')

  // AC-3: Platzhalter bei none/failed
  it.todo('should render ImageIcon placeholder when thumbnailStatus is none or failed')

  // AC-4: Refresh-Button bei Hover
  it.todo('should show RefreshCw button alongside Edit/Delete on hover')

  // AC-5: Refresh-Button Klick
  it.todo('should call onRefreshThumbnail with project.id and prevent navigation on click')

  // AC-6: Spinning Icon bei isRefreshing
  it.todo('should show spinning RefreshCw icon and disable button when isRefreshing is true')

  // AC-7: createProject loest Thumbnail-Generierung aus
  it.todo('should call generateForProject fire-and-forget after successful project creation')

  // AC-8: Interface rueckwaertskompatibel
  it.todo('should render correctly without thumbnailUrl and thumbnailStatus props')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-16-thumbnail-service` | `generateForProject(projectId)` | Service Function | Import aus `lib/services/thumbnail-service.ts` |
| `slice-16-thumbnail-service` | `generateThumbnail(input)` | Server Action | Import aus `app/actions/projects.ts` |
| `slice-02-db-schema-projects` | `projects.thumbnailUrl`, `projects.thumbnailStatus` | Schema Columns | Felder im Project-Typ vorhanden |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `ProjectCard` (erweitert) | React Component | Home Page | `onRefreshThumbnail?: (id: string) => Promise<void>` Prop |
| `createProject` (erweitert) | Server Action | Home Page | Unveraendertes Interface, intern Thumbnail-Trigger |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/project-card.tsx` -- Thumbnail-Anzeige (Image/Pulse/Platzhalter), Refresh-Button bei Hover, erweiterte Props
- [ ] `app/actions/projects.ts` -- `createProject` erweitern: fire-and-forget `generateForProject` nach Projekterstellung
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen am Thumbnail-Service selbst (Slice 16)
- KEINE DB-Schema-Aenderungen
- KEINE Migration
- KEIN Polling/Auto-Refresh fuer Thumbnail-Status-Updates (manuelle Page-Refresh oder kuenftiger Slice)

**Technische Constraints:**
- Next.js `Image`-Komponente fuer Thumbnail-Anzeige (R2-Hostname bereits in `next.config` konfiguriert)
- `RefreshCw` Icon aus `lucide-react` (bereits im Projekt)
- Fire-and-forget in `createProject`: `generateForProject(id).catch(console.error)` Pattern (kein await)
- `data-action="refresh-thumbnail"` Attribut am Button, damit Link-Click-Handler Navigation verhindert (bestehendes Pattern fuer rename/delete)
- Bestehende Props (`onRename`, `onDelete`) bleiben unveraendert, `onRefreshThumbnail` ist optional

**Referenzen:**
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` --> Section "Data Flow: Thumbnail Generation"
- Wireframes: `specs/phase-1/2026-03-07-quality-improvements/wireframes.md` --> Section "Screen: Home (Project Overview)" + "Project Card Hover State"
- Wireframes: `specs/phase-1/2026-03-07-quality-improvements/wireframes.md` --> Section "State Variations" (thumbnail states)
