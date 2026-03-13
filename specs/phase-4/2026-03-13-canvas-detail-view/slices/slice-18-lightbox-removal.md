# Slice 18: Lightbox Removal + Cleanup

> **Slice 18 von 18** fuer `Canvas Detail-View & Editing Flow`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-18-lightbox-removal` |
| **Test** | `pnpm test components/workspace/workspace-content.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-08-siblings-navigation"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/workspace-content.test.tsx` |
| **Integration Command** | `pnpm tsc --noEmit` |
| **Acceptance Command** | `pnpm test components/workspace/workspace-content.test.tsx` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` |

---

## Ziel

Alle Lightbox-Referenzen aus der Codebase entfernen, da die Lightbox vollstaendig durch die Canvas-Detail-View ersetzt wurde. Die Dateien `lightbox-modal.tsx` und `lightbox-navigation.tsx` werden geloescht, zugehoerige Imports und State-Variablen in `workspace-content.tsx` entfernt, und betroffene Test-Dateien aktualisiert oder entfernt.

---

## Acceptance Criteria

1) GIVEN `components/workspace/workspace-content.tsx` enthaelt aktuell `import { LightboxModal }` und `import { LightboxNavigation }`
   WHEN Slice 18 implementiert ist
   THEN enthaelt `workspace-content.tsx` keine Imports aus `@/components/lightbox/lightbox-modal` oder `@/components/lightbox/lightbox-navigation`

2) GIVEN `workspace-content.tsx` enthaelt aktuell State-Variablen `lightboxOpen`, `lightboxIndex` und zugehoerige Handler (`handleLightboxClose`, `handleLightboxNavigate`, `handleLightboxDelete`)
   WHEN Slice 18 implementiert ist
   THEN existieren keine dieser State-Variablen oder Handler mehr in der Datei

3) GIVEN `workspace-content.tsx` rendert aktuell `<LightboxModal>` und `<LightboxNavigation>` im JSX
   WHEN Slice 18 implementiert ist
   THEN sind beide Komponenten-Referenzen aus dem JSX entfernt

4) GIVEN die Datei `components/lightbox/lightbox-modal.tsx` existiert
   WHEN Slice 18 implementiert ist
   THEN ist die Datei geloescht (nicht mehr im Dateisystem vorhanden)

5) GIVEN die Datei `components/lightbox/lightbox-navigation.tsx` existiert
   WHEN Slice 18 implementiert ist
   THEN ist die Datei geloescht (Navigations-Logik wurde in Slice 08 nach `canvas-navigation.tsx` portiert)

6) GIVEN `components/lightbox/provenance-row.tsx` wird von der Canvas-Detail-View weiterverwendet
   WHEN Slice 18 implementiert ist
   THEN bleibt `provenance-row.tsx` unangetastet und funktionsfaehig

7) GIVEN die Test-Datei `components/workspace/workspace-content.test.tsx` mockt aktuell `LightboxModal` und `LightboxNavigation`
   WHEN Slice 18 implementiert ist
   THEN sind diese Mocks und alle lightbox-bezogenen Test-Assertions entfernt oder aktualisiert

8) GIVEN die Test-Dateien `components/lightbox/__tests__/lightbox-modal.test.tsx` und `components/lightbox/__tests__/lightbox-navigation.test.tsx` existieren
   WHEN Slice 18 implementiert ist
   THEN sind diese Test-Dateien geloescht

9) GIVEN alle Aenderungen aus Slice 18 sind durchgefuehrt
   WHEN `pnpm tsc --noEmit` ausgefuehrt wird
   THEN kompiliert das Projekt fehlerfrei (keine unresolved imports, keine unused variables)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/workspace/__tests__/workspace-content-no-lightbox.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('WorkspaceContent - Lightbox Removal', () => {
  // AC-1: Keine Lightbox-Imports
  it.todo('should not import LightboxModal or LightboxNavigation')

  // AC-2: Keine Lightbox-State-Variablen
  it.todo('should not contain lightboxOpen or lightboxIndex state')

  // AC-3: Keine Lightbox-Komponenten im JSX
  it.todo('should not render LightboxModal or LightboxNavigation components')

  // AC-7: Lightbox-Mocks in workspace-content.test.tsx bereinigt
  it.todo('should not contain LightboxModal or LightboxNavigation mocks in workspace-content tests')

  // AC-9: Build kompiliert fehlerfrei
  it.todo('should compile without TypeScript errors after lightbox removal')
})
```
</test_spec>

### Test-Datei: `components/lightbox/__tests__/lightbox-files-removed.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Lightbox Files Removal', () => {
  // AC-4: lightbox-modal.tsx geloescht
  it.todo('should have removed lightbox-modal.tsx file')

  // AC-5: lightbox-navigation.tsx geloescht
  it.todo('should have removed lightbox-navigation.tsx file')

  // AC-6: provenance-row.tsx bleibt bestehen
  it.todo('should keep provenance-row.tsx intact')

  // AC-8: Lightbox-Test-Dateien geloescht
  it.todo('should have removed lightbox-modal.test.tsx and lightbox-navigation.test.tsx')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-08-siblings-navigation` | `CanvasNavigation` | React Component | Ersetzt LightboxNavigation Prev/Next-Logik |
| `slice-05-detail-view-shell` | `CanvasDetailView` | React Component | Ersetzt LightboxModal als Detail-Ansicht |
| `slice-05-detail-view-shell` | `detailViewOpen` State | WorkspaceContent State | Ersetzt `lightboxOpen` State-Variable |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| Bereinigte `workspace-content.tsx` | Refactored File | Alle nachfolgenden Slices | Keine Lightbox-Artefakte mehr, nur Canvas-Detail-View |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/workspace-content.tsx` — Lightbox-Imports, State-Variablen, Handler und JSX-Referenzen entfernen
- [ ] `components/lightbox/lightbox-modal.tsx` — Datei loeschen
- [ ] `components/lightbox/lightbox-navigation.tsx` — Datei loeschen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- NICHT `components/lightbox/provenance-row.tsx` entfernen (wird von CanvasDetailView weiterverwendet)
- NICHT die Test-Dateien `provenance-row.test.tsx`, `variation-flow.test.tsx`, `download-button.test.tsx`, `use-as-reference.test.tsx` oder `lightbox-provenance-integration.test.tsx` loeschen, sofern sie keine direkten LightboxModal/LightboxNavigation-Imports haben — nur Lightbox-spezifische Mocks/Referenzen darin aktualisieren
- KEINE neuen Features hinzufuegen — nur bestehende Lightbox-Artefakte entfernen
- KEINE Aenderungen an `lib/workspace-state.tsx` (Kommentar-Referenz auf Lightbox ist informativ, kein Breaking Change)

**Technische Constraints:**
- Sicherstellen, dass `workspace-content.tsx` nach der Entfernung weiterhin die `CanvasDetailView` (aus Slice 05) korrekt rendert
- Build-Validierung via `pnpm tsc --noEmit` ist Pflicht nach allen Loeschungen
- Die geloeschten Lightbox-Test-Dateien (`lightbox-modal.test.tsx`, `lightbox-navigation.test.tsx`) muessen VOR dem Test-Run entfernt sein

**Referenzen:**
- Architecture: `specs/phase-4/2026-03-13-canvas-detail-view/architecture.md` → Section "Migration Map > Files to Remove"
- Architecture: `specs/phase-4/2026-03-13-canvas-detail-view/architecture.md` → Section "Migration Map" (workspace-content.tsx Aenderungen)
- Discovery: `specs/phase-4/2026-03-13-canvas-detail-view/discovery.md` → Section "Context & Research > Similar Patterns" (LightboxModal, LightboxNavigation)
