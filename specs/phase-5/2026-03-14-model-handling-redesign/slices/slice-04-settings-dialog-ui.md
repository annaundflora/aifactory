# Slice 4: Settings Dialog UI

> **Slice 4 von 13** fuer `Model Handling Redesign`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-04-settings-dialog-ui` |
| **Test** | `pnpm test components/settings components/workspace/workspace-header` |
| **E2E** | `false` |
| **Dependencies** | `["slice-03-server-actions-model-settings"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/settings` |
| **Integration Command** | `pnpm test components/settings components/workspace` |
| **Acceptance Command** | `pnpm test components/settings components/workspace` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (Server Actions und CollectionModelService werden gemockt) |

---

## Ziel

Settings-Button (Gear-Icon) im Workspace Header einbauen und einen modalen Settings-Dialog implementieren, der die Model-Zuweisung pro Mode und Tier ermoeglicht. Die Dropdowns laden Models aus der Replicate Collection und filtern inkompatible Models. Aenderungen werden per Auto-Save sofort persistiert.

---

## Acceptance Criteria

1) GIVEN die WorkspaceHeader-Komponente wird gerendert
   WHEN der User den rechten Aktionsbereich betrachtet
   THEN ist ein Gear-Icon-Button links neben dem ThemeToggle sichtbar

2) GIVEN der Settings-Button im Header ist sichtbar
   WHEN der User auf den Settings-Button klickt
   THEN oeffnet sich ein modaler Dialog mit dem Titel "Model Settings" und einem Close-Button (X)

3) GIVEN der Settings-Dialog ist geoeffnet
   WHEN der User ESC drueckt oder ausserhalb des Dialogs klickt
   THEN schliesst sich der Dialog

4) GIVEN der Settings-Dialog ist geoeffnet
   WHEN der User den Dialog-Inhalt betrachtet
   THEN sind 3 Mode-Sections sichtbar: "TEXT TO IMAGE" (3 Dropdowns: Draft, Quality, Max), "IMAGE TO IMAGE" (3 Dropdowns: Draft, Quality, Max), "UPSCALE" (2 Dropdowns: Draft, Quality -- kein Max)

5) GIVEN der Settings-Dialog ist geoeffnet und `getModelSettings()` liefert die 8 Seed-Eintraege
   WHEN die Dropdowns gerendert werden
   THEN zeigt jeder Dropdown den aktuell zugewiesenen Model-Namen im Format `owner/name` (z.B. "black-forest-labs/flux-schnell" fuer txt2img/Draft)

6) GIVEN ein Dropdown in der txt2img-Section wird geoeffnet
   WHEN `getCollectionModels()` die Collection-Models zurueckliefert
   THEN zeigt die Dropdown-Liste alle Collection-Models mit Model-Name (fett) und Owner (muted) als Items

7) GIVEN ein Dropdown in der img2img-Section wird geoeffnet
   WHEN ein Model in der Liste keinen img2img-Support hat (Kompatibilitaetspruefung via Schema)
   THEN ist dieses Model ausgegraut und nicht selektierbar

8) GIVEN ein Dropdown ist geoeffnet und alle Models sind geladen
   WHEN der User ein kompatibles Model auswaehlt
   THEN wird `updateModelSetting()` mit dem korrekten `{ mode, tier, modelId }` aufgerufen, der Dropdown schliesst sich, und der neue Model-Name wird sofort angezeigt (Auto-Save)

9) GIVEN der User hat ein Model in der txt2img/Draft-Dropdown geaendert
   WHEN der User den Dialog schliesst und erneut ueber den Settings-Button oeffnet
   THEN zeigt der txt2img/Draft-Dropdown die neue Auswahl (Persistenz ueber `getModelSettings()`)

10) GIVEN `getCollectionModels()` schlaegt fehl (Netzwerkfehler)
    WHEN ein Dropdown die Models laden will
    THEN wird eine Fehlermeldung angezeigt anstelle der Model-Liste (z.B. "Could not load models")

11) GIVEN die `ModelModeSection`-Komponente wird mit `mode="upscale"` gerendert
    WHEN die Tier-Dropdowns angezeigt werden
    THEN werden nur 2 Dropdowns gerendert (Draft, Quality) -- kein Max-Dropdown

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/settings/__tests__/settings-dialog.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('SettingsDialog', () => {
  // AC-2: Dialog oeffnet sich
  it.todo('should render modal with title "Model Settings" and close button when open')

  // AC-3: Dialog schliessen
  it.todo('should close when close button is clicked')

  // AC-4: 3 Mode-Sections
  it.todo('should render TEXT TO IMAGE, IMAGE TO IMAGE, and UPSCALE sections')

  // AC-5: Aktuelle Model-Zuweisung anzeigen
  it.todo('should display current model assignments from getModelSettings in each dropdown')

  // AC-8: Auto-Save bei Model-Auswahl
  it.todo('should call updateModelSetting with correct mode, tier, and modelId on selection')

  // AC-9: Persistenz nach Reopen
  it.todo('should show updated model after closing and reopening dialog')

  // AC-10: Collection-Ladefehler
  it.todo('should show error message when getCollectionModels fails')
})
```
</test_spec>

### Test-Datei: `components/settings/__tests__/model-mode-section.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('ModelModeSection', () => {
  // AC-4: Upscale hat kein Max-Dropdown
  it.todo('should render only Draft and Quality dropdowns for upscale mode')

  // AC-4: txt2img/img2img haben 3 Dropdowns
  it.todo('should render Draft, Quality, and Max dropdowns for txt2img mode')

  // AC-6: Dropdown-Items zeigen Model-Name und Owner
  it.todo('should render collection models with name and owner in dropdown list')

  // AC-7: Inkompatible Models ausgegraut
  it.todo('should disable incompatible models in img2img dropdown')
})
```
</test_spec>

### Test-Datei: `components/workspace/__tests__/workspace-header-settings.test.tsx`

<test_spec>
```typescript
import { describe, it } from 'vitest'

describe('WorkspaceHeader Settings Button', () => {
  // AC-1: Gear-Icon sichtbar
  it.todo('should render settings button with gear icon before ThemeToggle')

  // AC-2: Button oeffnet Dialog
  it.todo('should open SettingsDialog when settings button is clicked')
})
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-03` | `getModelSettings` | Server Action | `() => Promise<ModelSetting[]>` -- liefert aktuelle Zuweisungen |
| `slice-03` | `updateModelSetting` | Server Action | `(input: UpdateModelSettingInput) => Promise<ModelSetting \| { error: string }>` |
| `slice-03` | `GenerationMode`, `Tier` | Types | `"txt2img" \| "img2img" \| "upscale"` bzw. `"draft" \| "quality" \| "max"` |
| (existing) | `CollectionModelService.getCollectionModels` | Service Function | `() => Promise<CollectionModel[]>` -- Replicate Collection Models |
| (existing) | `ModelSchemaService.supportsImg2Img` | Service Function | `(modelId: string) => Promise<boolean>` -- Kompatibilitaetspruefung |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `SettingsDialog` | React Component | slice-06+ (indirekt via WorkspaceHeader) | `<SettingsDialog open={boolean} onOpenChange={(open) => void} />` |
| `ModelModeSection` | React Component | intern (SettingsDialog) | `<ModelModeSection mode={GenerationMode} settings={ModelSetting[]} ... />` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/settings/settings-dialog.tsx` -- Neuer modaler Dialog: laedt Settings via `getModelSettings()`, rendert 3 `ModelModeSection`-Instanzen, Auto-Save via `updateModelSetting()`
- [ ] `components/settings/model-mode-section.tsx` -- Wiederverwendbare Section-Komponente: Section-Header, 2-3 Model-Dropdowns, Collection-Model-Loading, Kompatibilitaets-Filtering
- [ ] `components/workspace/workspace-header.tsx` -- Bestehende Datei erweitern: Settings-Button (Gear-Icon) + `useState` fuer Dialog-Open-State + `SettingsDialog` rendern
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE Tier-Toggle-Komponente (kommt in Slice 5)
- KEINE Aenderungen an der Generation-Logik oder prompt-area.tsx
- KEINE Aenderungen am Canvas
- KEINE neuen Server Actions oder Service-Funktionen -- nur bestehende aus Slice 1-3 konsumieren
- KEINE Inline-Kompatibilitaetspruefung im Dialog-Code -- delegieren an bestehenden `ModelSchemaService` oder die Server Action

**Technische Constraints:**
- Shadcn `Dialog` Komponente fuer das Modal (bestehendes Pattern)
- Shadcn `Select` oder Combobox fuer Model-Dropdowns
- Client Component (`"use client"`) fuer Dialog + Dropdowns (State-Management)
- Settings-Button: Lucide `Settings` Icon, `variant="ghost"`, `size="icon"`, positioniert links neben `ThemeToggle` im `ml-auto`-Container
- Collection-Models via `getCollectionModels()` laden (1h-Cache, bestehender Service)
- Auto-Save: `updateModelSetting()` direkt bei `onValueChange` des Select aufrufen, kein separater Save-Button

**Referenzen:**
- Dialog-Layout: `wireframes.md` -> Section "Screen: Settings Dialog (new)"
- Dropdown-Verhalten: `wireframes.md` -> Section "Settings Dialog" -> "State Variations"
- API-Signaturen: `architecture.md` -> Section "Server Actions (new)"
- Kompatibilitaetspruefung: `architecture.md` -> Section "Validation Rules" + "Error Handling Strategy"
- Workspace Header Ist-Zustand: `architecture.md` -> Section "Migration Map" -> `workspace-header.tsx`
