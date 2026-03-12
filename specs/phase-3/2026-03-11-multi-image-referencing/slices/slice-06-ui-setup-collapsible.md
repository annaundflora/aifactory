# Slice 06: UI Setup (Collapsible + Panel Width)

> **Slice 06** fuer `Multi-Image Referencing`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-06-ui-setup-collapsible` |
| **Test** | `pnpm test components/workspace/workspace-content.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/workspace-content.test.tsx` |
| **Integration Command** | — |
| **Acceptance Command** | — |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

shadcn Collapsible-Komponente installieren und die Panel-Breite der Prompt-Area von `w-80` (320px) auf `w-[480px]` erhoehen. Dies schafft die UI-Grundlage fuer die ReferenceBar (spaetere Slices) und stellt sicher, dass genug Platz fuer Referenz-Slots mit allen Controls vorhanden ist.

---

## Acceptance Criteria

1) GIVEN die Codebasis ohne `components/ui/collapsible.tsx`
   WHEN `npx shadcn add collapsible` ausgefuehrt wird
   THEN existiert `components/ui/collapsible.tsx` mit den Exports `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`

2) GIVEN `components/ui/collapsible.tsx` existiert
   WHEN eine beliebige Datei `import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"` ausfuehrt
   THEN kompiliert das Projekt ohne TypeScript-Fehler

3) GIVEN die Datei `workspace-content.tsx` mit Panel-Klasse `w-80`
   WHEN die Klasse auf `w-[480px]` geaendert wird
   THEN rendert das Prompt-Area-Panel mit einer festen Breite von 480px

4) GIVEN die geaenderte `workspace-content.tsx` und die neue `collapsible.tsx`
   WHEN `pnpm build` ausgefuehrt wird
   THEN beendet der Build-Prozess ohne Fehler (Exit-Code 0)

5) GIVEN die App laeuft mit `pnpm dev`
   WHEN die Workspace-Seite eines Projekts geladen wird
   THEN ist das linke Panel sichtbar breiter als vorher und die Gallery passt sich im verbleibenden Platz an (Flexbox-Verhalten unveraendert)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbstaendig.

### Test-Datei: `components/workspace/workspace-content.test.tsx`

<test_spec>
```typescript
// AC-1: Collapsible-Exports vorhanden
it.todo('should export Collapsible, CollapsibleTrigger, and CollapsibleContent from collapsible.tsx')

// AC-2: Collapsible importierbar ohne TypeScript-Fehler
it.todo('should allow importing Collapsible components without type errors')

// AC-3: Panel-Breite ist 480px
it.todo('should render prompt area panel with w-[480px] class instead of w-80')

// AC-4: Build laeuft fehlerfrei (Build-Test, nicht als Unit-Test abbildbar — Orchestrator prueft via pnpm build)

// AC-5: Gallery passt sich an breiteres Panel an
it.todo('should render gallery section with flex-1 filling remaining space')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| — | — | — | Keine Dependencies |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `Collapsible` | React Component | ReferenceBar (spaeterer Slice) | `import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"` |
| Panel-Breite 480px | Layout | ReferenceBar (spaeterer Slice) | `workspace-content.tsx` Panel rendert 480px breit |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/ui/collapsible.tsx` — shadcn Collapsible-Komponente (via `npx shadcn add collapsible`)
- [ ] `components/workspace/workspace-content.tsx` — Panel-Klasse von `w-80` auf `w-[480px]` aendern
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice erstellt KEINE ReferenceBar-Komponente (spaeterer Slice)
- Dieser Slice aendert KEINE andere Logik in `workspace-content.tsx` ausser der Panel-Breite
- Keine funktionalen Aenderungen an PromptArea oder GalleryGrid

**Technische Constraints:**
- Collapsible MUSS via `npx shadcn add collapsible` installiert werden (kein manuelles Copy-Paste)
- Panel-Breite exakt `w-[480px]` (Tailwind arbitrary value), nicht `w-[30rem]` oder andere Einheiten
- Keine weiteren shadcn-Komponenten in diesem Slice installieren

**Referenzen:**
- Architecture: `specs/phase-3/2026-03-11-multi-image-referencing/architecture.md` → Section "Migration Map" (workspace-content.tsx Zeile)
- Architecture: `specs/phase-3/2026-03-11-multi-image-referencing/architecture.md` → Section "Constraints & Integrations" (shadcn Collapsible)
- Wireframes: `specs/phase-3/2026-03-11-multi-image-referencing/wireframes.md` → Screen "Prompt Area — img2img Mode" (480px Panel-Kontext)
