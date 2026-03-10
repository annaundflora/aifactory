# Slice 1: shadcn Badge installieren

> **Slice 1 von 14** fuer `Model Cards & Multi-Model Selection`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-01-shadcn-badge` |
| **Test** | `pnpm test components/ui` |
| **E2E** | `false` |
| **Dependencies** | `[]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/ui/__tests__/badge.test.tsx` |
| **Integration Command** | `pnpm build` |
| **Acceptance Command** | `pnpm build` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `no_mocks` |

---

## Ziel

shadcn/ui Badge-Komponente zum Projekt hinzufuegen. Die Badge-Komponente wird in spaeteren Slices fuer den Model Badge auf Gallery-Thumbnails (Slice 13) und den Run-Count-Badge auf Model Cards (Slice 06) benoetigt.

---

## Acceptance Criteria

1) GIVEN das Projekt ohne `components/ui/badge.tsx`
   WHEN der Implementer `pnpm dlx shadcn@3 add badge` ausfuehrt
   THEN existiert die Datei `components/ui/badge.tsx` im Projekt

2) GIVEN die Datei `components/ui/badge.tsx` existiert
   WHEN die Datei importiert wird
   THEN exportiert sie die Named Exports `Badge` (React-Komponente) und `badgeVariants` (cva-Funktion)

3) GIVEN die Badge-Komponente installiert ist
   WHEN `Badge` mit `variant="default"` gerendert wird
   THEN rendert die Komponente ein `<div>` (oder `<span>`) Element mit den entsprechenden CSS-Klassen

4) GIVEN die Badge-Komponente installiert ist
   WHEN `Badge` mit `variant="secondary"` gerendert wird
   THEN rendert die Komponente mit der Secondary-Variante (unterschiedliche CSS-Klassen als Default)

5) GIVEN die Badge-Komponente installiert ist
   WHEN `Badge` mit einem `children`-Prop gerendert wird (z.B. "2.3M runs")
   THEN wird der Text-Inhalt korrekt angezeigt

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/ui/__tests__/badge.test.tsx`

<test_spec>
```typescript
// AC-1: Badge-Datei existiert und ist importierbar
it.todo('should be importable from components/ui/badge')

// AC-2: Named Exports Badge und badgeVariants
it.todo('should export Badge component and badgeVariants function')

// AC-3: Default-Variante rendern
it.todo('should render with default variant')

// AC-4: Secondary-Variante rendern
it.todo('should render with secondary variant')

// AC-5: Children korrekt anzeigen
it.todo('should display children text content')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| -- | -- | -- | Erster Slice, keine Abhaengigkeiten |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `Badge` | React Component | `slice-06` (Model Card), `slice-13` (Gallery Model Badge) | `Badge: React.FC<BadgeProps>` |
| `badgeVariants` | CVA Function | `slice-06` (Model Card) | `badgeVariants: (props?) => string` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/ui/badge.tsx` -- shadcn/ui Badge-Komponente (generiert via CLI)
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- Dieser Slice erstellt NUR die Badge-Komponente via shadcn CLI
- KEINE Custom-Varianten oder Anpassungen (kommen in spaeteren Slices bei Bedarf)
- KEINE Verwendung der Badge-Komponente in anderen Dateien (kommt in Slice 06 und 13)

**Technische Constraints:**
- `pnpm dlx shadcn@3 add badge` verwenden (shadcn v3 CLI, passend zu `"shadcn": "^3.8.5"` in package.json)
- Badge nutzt `class-variance-authority` (bereits als Dependency installiert)
- Badge nutzt `tailwind-merge` via `cn()`-Utility (bereits im Projekt unter `lib/utils.ts`)
- Build-Validierung (`pnpm build` kompiliert fehlerfrei) wird durch den Integration Command in der Pipeline geprueft -- kein separates AC noetig

**Referenzen:**
- Architecture: `specs/phase-2/2026-03-07-model-cards/architecture.md` -> Section "Integrations" (shadcn Badge Eintrag)
- Architecture: `specs/phase-2/2026-03-07-model-cards/architecture.md` -> Section "Technology Decisions" (Badge Component)
