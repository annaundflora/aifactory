# Slice 15: Template Selector UI

> **Slice 15 von 21** fuer `quality-improvements`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-15-template-selector-ui` |
| **Test** | `pnpm test lib/__tests__/prompt-templates.test.ts components/workspace/__tests__/template-selector.test.tsx` |
| **E2E** | `false` |
| **Dependencies** | `["slice-08-prompt-tabs-container"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/__tests__/prompt-templates.test.ts components/workspace/__tests__/template-selector.test.tsx` |
| **Integration Command** | `--` |
| **Acceptance Command** | `pnpm build` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `--` |
| **Mocking Strategy** | `mock_external` (workspace-state Context mocken, Prompt-Felder als Mock-Callbacks) |

---

## Ziel

Hardcoded Prompt-Templates als Config-Datei bereitstellen und eine Template-Selector-Komponente im Prompt-Tab erstellen. Der Selector zeigt 5 vordefinierte Templates als Dropdown an. Klick auf ein Template befuellt alle drei Prompt-Felder (Motiv, Style, Negative Prompt). Bei nicht-leeren Feldern erscheint ein Confirmation Dialog vor dem Ueberschreiben.

---

## Acceptance Criteria

1. GIVEN `lib/prompt-templates.ts` wird importiert
   WHEN die exportierte Template-Liste gelesen wird
   THEN enthaelt sie genau 5 Templates mit den IDs "product-shot", "landscape", "character-design", "logo-design", "abstract-art"

2. GIVEN ein Template-Objekt aus der Liste
   WHEN seine Felder geprueft werden
   THEN hat es die Properties `id` (string), `label` (string), `motiv` (string, nicht leer), `style` (string, nicht leer), `negativePrompt` (string, nicht leer)

3. GIVEN der Prompt-Tab ist aktiv
   WHEN der User die Prompt Area betrachtet
   THEN ist ein "Templates"-Button sichtbar (unterhalb der Builder/Improve-Buttons, siehe wireframes.md Annotation 9)

4. GIVEN der Templates-Button ist sichtbar
   WHEN der User auf den Templates-Button klickt
   THEN oeffnet sich ein Dropdown/Popover mit genau 5 Eintraegen: "Product Shot", "Landscape", "Character Design", "Logo Design", "Abstract Art"

5. GIVEN das Templates-Dropdown ist offen und alle Prompt-Felder sind leer
   WHEN der User auf "Product Shot" klickt
   THEN wird das Motiv-Feld mit dem Template-Motiv-Platzhalter befuellt, das Style-Feld mit dem Template-Style-Text und das Negative-Prompt-Feld mit dem Template-Negative-Text. Das Dropdown schliesst sich.

6. GIVEN mindestens ein Prompt-Feld (Motiv, Style oder Negative) enthaelt Text
   WHEN der User auf ein Template im Dropdown klickt
   THEN erscheint ein Confirmation Dialog mit dem Text "Replace current prompt?" und den Buttons "Cancel" und "Apply"

7. GIVEN der Confirmation Dialog ist sichtbar
   WHEN der User auf "Cancel" klickt
   THEN schliesst sich der Dialog ohne Aenderungen an den Prompt-Feldern

8. GIVEN der Confirmation Dialog ist sichtbar
   WHEN der User auf "Apply" klickt
   THEN werden alle drei Prompt-Felder mit den Template-Werten ueberschrieben und der Dialog schliesst sich

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes `it.todo()` referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/__tests__/prompt-templates.test.ts`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Prompt Templates Config', () => {
  // AC-1: 5 Templates mit korrekten IDs
  it.todo('should export exactly 5 templates with IDs: product-shot, landscape, character-design, logo-design, abstract-art')

  // AC-2: Template-Objekt-Struktur
  it.todo('should have id, label, motiv, style, negativePrompt as non-empty strings on each template')
})
```
</test_spec>

### Test-Datei: `components/workspace/__tests__/template-selector.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('Template Selector', () => {
  // AC-3: Templates-Button sichtbar
  it.todo('should render a Templates button in the prompt area')

  // AC-4: Dropdown zeigt 5 Template-Optionen
  it.todo('should open dropdown with 5 template options when Templates button is clicked')

  // AC-5: Template befuellt leere Felder direkt
  it.todo('should fill all three prompt fields with template values when fields are empty and template is clicked')

  // AC-6: Confirmation Dialog bei nicht-leeren Feldern
  it.todo('should show confirmation dialog when a template is clicked and prompt fields contain text')

  // AC-7: Cancel laesst Felder unveraendert
  it.todo('should close dialog without changes when Cancel is clicked')

  // AC-8: Apply ueberschreibt Felder mit Template-Werten
  it.todo('should overwrite all prompt fields with template values when Apply is clicked')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-08-prompt-tabs-container` | Prompt-Tab Content-Bereich | Component-Slot | Template-Selector wird im Prompt-Tab gerendert |
| `slice-08-prompt-tabs-container` | Prompt-Feld-State (motiv, style, negativePrompt) | State/Callbacks | Setter-Funktionen zum Befuellen der Felder, Getter zum Pruefen ob leer |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `PROMPT_TEMPLATES` | Config-Array | Beliebig | `PromptTemplate[]` aus `lib/prompt-templates.ts` |
| `TemplateSelector` | Component | `prompt-area.tsx` | `<TemplateSelector onApplyTemplate={(template: PromptTemplate) => void} hasContent={boolean} />` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/prompt-templates.ts` -- Neue Datei: Hardcoded Config mit 5 PromptTemplate-Objekten (Product Shot, Landscape, Character Design, Logo Design, Abstract Art). Exportiert Type `PromptTemplate` und Array `PROMPT_TEMPLATES`.
- [ ] `components/workspace/template-selector.tsx` -- Neue Datei: Dropdown/Popover-Komponente mit Template-Liste. Nutzt shadcn Popover oder DropdownMenu. Integriert AlertDialog fuer Confirmation bei nicht-leeren Feldern.
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE user-erstellten Templates (nur hardcoded, V1-Entscheidung)
- KEINE Persistierung von Template-Auswahl oder -History
- KEINE Aenderung an den strukturierten Prompt-Feldern selbst (Slice 07 Logik bleibt)
- KEINE Server Actions -- rein client-seitige Logik
- KEIN Template-Editing oder -Management

**Technische Constraints:**
- Nutze shadcn Popover oder DropdownMenu fuer das Template-Dropdown
- Nutze shadcn AlertDialog fuer den Confirmation Dialog (radix-ui, bereits verfuegbar)
- Template-Werte aus architecture.md Section "Predefined Templates" uebernehmen
- `data-testid="template-selector-trigger"` auf dem Templates-Button
- `data-testid="template-option-{id}"` auf jedem Template-Eintrag im Dropdown
- `data-testid="template-confirm-dialog"` auf dem Confirmation Dialog

**Referenzen:**
- Architecture: `specs/phase-1/2026-03-07-quality-improvements/architecture.md` -- Section "Prompt Templates Architecture" (Zeilen 506-529): Template-Struktur und vordefinierte Werte
- Wireframes: `specs/phase-1/2026-03-07-quality-improvements/wireframes.md` -- Section "Workspace - Template Selection" (Zeilen 352-414): Dropdown-Layout, Annotation 9, Confirmation Dialog
- Discovery: `specs/phase-1/2026-03-07-quality-improvements/discovery.md` -- Flow 6 "Template verwenden" (Zeilen 135-141): User Flow und Business Rules
