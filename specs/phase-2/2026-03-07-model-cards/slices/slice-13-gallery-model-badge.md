# Slice 13: Gallery Model Badge hinzufuegen

> **Slice 13 von 14** fuer `Model Cards & Multi-Model Selection`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-13-gallery-model-badge` |
| **Test** | `pnpm test components/workspace/__tests__/generation-card.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-01-shadcn-badge", "slice-05-remove-model-lookup"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/workspace/__tests__/generation-card.test.tsx` |
| **Integration Command** | `pnpm build` |
| **Acceptance Command** | `pnpm build` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

Model Badge als permanentes Overlay (bottom-left) auf allen Gallery-Thumbnails hinzufuegen. Der Badge zeigt den lesbaren Display-Namen des Modells, abgeleitet aus `generation.modelId` via `modelIdToDisplayName`. Damit ist das verwendete Modell jederzeit in der Gallery erkennbar, nicht nur in der Lightbox.

---

## Acceptance Criteria

1) GIVEN eine `GenerationCard` mit `generation.modelId = "black-forest-labs/flux-1.1-pro"`
   WHEN die Komponente gerendert wird
   THEN ist ein Badge-Element mit dem Text `"Flux 1.1 Pro"` sichtbar (nicht erst bei Hover)

2) GIVEN eine `GenerationCard` mit `generation.modelId = "recraft-ai/recraft-v4"`
   WHEN die Komponente gerendert wird
   THEN zeigt der Badge den Text `"Recraft V4"` (korrekte `modelIdToDisplayName`-Transformation)

3) GIVEN eine `GenerationCard` mit einem Model-ID-String ohne `/` (z.B. `"flux-dev"`)
   WHEN die Komponente gerendert wird
   THEN zeigt der Badge den Text `"Flux Dev"` (Fallback: gesamter String wird als Name behandelt)

4) GIVEN eine `GenerationCard` mit einem sehr langen Model-Namen (> Badge-Breite)
   WHEN die Komponente gerendert wird
   THEN wird der Text mit `text-overflow: ellipsis` (CSS `truncate`) abgeschnitten und laeuft nicht aus dem Badge heraus

5) GIVEN eine `GenerationCard`
   WHEN die Komponente gerendert wird
   THEN ist der Badge absolut positioniert (bottom-left), besitzt einen semi-transparenten dunklen Hintergrund und weissen Text, und ist unabhaengig vom Hover-Zustand sichtbar

6) GIVEN eine `GenerationCard` mit `generation.modelId = ""`
   WHEN die Komponente gerendert wird
   THEN wird kein Badge-Element gerendert (leerer modelId = kein Badge)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/workspace/__tests__/generation-card.test.tsx`

<test_spec>
```typescript
// AC-1: Badge zeigt Display-Namen fuer standard Model-ID
it.todo('should render badge with display name "Flux 1.1 Pro" for modelId "black-forest-labs/flux-1.1-pro"')

// AC-2: Badge wendet modelIdToDisplayName korrekt an
it.todo('should render badge with display name "Recraft V4" for modelId "recraft-ai/recraft-v4"')

// AC-3: Fallback bei Model-ID ohne Slash
it.todo('should render badge with display name "Flux Dev" for modelId "flux-dev"')

// AC-4: Langer Name wird truncated
it.todo('should truncate long model name with ellipsis')

// AC-5: Badge ist immer sichtbar (nicht nur bei Hover)
it.todo('should always render badge regardless of hover state')

// AC-6: Kein Badge bei leerem modelId
it.todo('should not render badge when modelId is empty string')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-01-shadcn-badge` | `Badge` | React Component | `import { Badge } from "@/components/ui/badge"` verfuegbar |
| `slice-05-remove-model-lookup` | `modelIdToDisplayName` | Pure Function | `import { modelIdToDisplayName } from "@/lib/utils/model-display-name"` verfuegbar; `modelIdToDisplayName(modelId: string): string` |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `GenerationCard` (erweitert) | React Component | Gallery-Grid (bestehend) | Props unveraendert: `GenerationCardProps` (kein neues Prop noetig, `modelId` kommt aus `generation.modelId`) |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/workspace/generation-card.tsx` -- Model Badge Overlay hinzufuegen (bottom-left, semi-transparent, truncated Text via `modelIdToDisplayName`)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Aenderungen an der `GenerationCardProps`-Interface (kein neues Prop)
- KEINE Aenderungen am Hover-Overlay (Prompt-Text bleibt unveraendert)
- KEINE Aenderungen an der Lightbox (wurde in Slice 05 behandelt)
- KEIN eigenes Badge-Styling -- `Badge`-Komponente aus slice-01 verwenden

**Technische Constraints:**
- Badge via `Badge` aus `@/components/ui/badge` (shadcn, installiert in slice-01)
- Display-Name via `modelIdToDisplayName` aus `@/lib/utils/model-display-name` (erstellt in slice-05)
- Badge absolut positioniert: `absolute bottom-2 left-2`
- Semi-transparenter Hintergrund: Tailwind `bg-black/60` oder vergleichbar
- Text-Overflow: `max-w-[calc(100%-1rem)] truncate` oder aequivalent
- Kein Badge wenn `generation.modelId` leer ist (Conditional Render)

**Referenzen:**
- Discovery: `specs/phase-2/2026-03-07-model-cards/discovery.md` -> Section "Gallery Thumbnails" (Layout change)
- Architecture: `specs/phase-2/2026-03-07-model-cards/architecture.md` -> Section "Migration Map" (generation-card.tsx Eintrag)
- Architecture: `specs/phase-2/2026-03-07-model-cards/architecture.md` -> Section "Technology Decisions" (Model display name from modelId split)
