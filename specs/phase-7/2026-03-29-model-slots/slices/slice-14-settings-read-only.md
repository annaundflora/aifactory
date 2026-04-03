# Slice 14: Settings Dialog Read-Only

> **Slice 14 von 15** fuer `Model Slots`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-14-settings-read-only` |
| **Test** | `pnpm test components/settings` |
| **E2E** | `false` |
| **Dependencies** | `["slice-05-server-actions"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test components/settings` |
| **Integration Command** | `pnpm tsc --noEmit` |
| **Acceptance Command** | N/A |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | N/A |
| **Mocking Strategy** | `mock_external` (Server Actions + model data via Vitest mocks) |

---

## Ziel

`settings-dialog.tsx` und `model-mode-section.tsx` von editierbaren Tier-Dropdowns auf eine Read-Only-Anzeige der Slot-Zuweisungen umstellen. Model-Aenderungen finden kuenftig ausschliesslich im Workspace statt — der Settings-Dialog zeigt nur noch den aktuellen Zustand an.

---

## Acceptance Criteria

1) GIVEN der Settings-Dialog wird geoeffnet und `getModelSlots()` liefert 15 Slots (5 Modes x 3 Slots)
   WHEN der Dialog gerendert wird
   THEN werden alle 5 Mode-Sections angezeigt (TEXT TO IMAGE, IMAGE TO IMAGE, UPSCALE, INPAINT, OUTPAINT)
   AND jede Section zeigt genau 3 Slot-Zeilen (Slot 1, Slot 2, Slot 3)

2) GIVEN ein Slot hat `modelId: "black-forest-labs/flux-schnell"` und `active: true`
   WHEN die Slot-Zeile gerendert wird
   THEN zeigt sie das Slot-Label (z.B. "Slot 1"), den Model-Display-Namen und einen gruenen Status-Dot mit Text "on"

3) GIVEN ein Slot hat `modelId: "black-forest-labs/flux-2-pro"` und `active: false`
   WHEN die Slot-Zeile gerendert wird
   THEN zeigt sie das Slot-Label, den Model-Display-Namen und einen grauen Status-Dot mit Text "off"

4) GIVEN ein Slot hat `modelId: null` (leerer Slot)
   WHEN die Slot-Zeile gerendert wird
   THEN zeigt sie das Slot-Label, den Text "not assigned" in muted Styling und einen grauen Status-Dot mit Text "off"

5) GIVEN der Dialog ist gerendert
   WHEN der User versucht einen Model-Namen oder Status zu aendern
   THEN gibt es keine editierbaren Elemente (keine Dropdowns, keine Checkboxen, keine onChange-Handler)

6) GIVEN der Dialog ist gerendert
   WHEN der User den unteren Bereich betrachtet
   THEN wird der Hint-Text "Change models in the workspace." angezeigt

7) GIVEN der Sync-Button wird geklickt
   WHEN der Sync-Prozess laeuft
   THEN zeigt der Button den Spinner und "Syncing..." (unveraendertes Verhalten gegenueber dem bestehenden Sync-Flow)
   AND nach Abschluss wird die Slot-Anzeige mit aktuellen Daten aktualisiert

8) GIVEN der Dialog wird geoeffnet
   WHEN `getModelSlots()` aufgerufen wird (statt des alten `getModelSettings()`)
   THEN werden die Slots korrekt geladen und angezeigt
   AND der Event-Listener lauscht auf `"model-slots-changed"` (statt `"model-settings-changed"`)

9) GIVEN der Model-Katalog ist leer (keine Models gesynct)
   WHEN der Dialog geoeffnet wird
   THEN wird pro Mode eine Empty-State-Meldung angezeigt (bestehendes Empty-State-Pattern beibehalten)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `components/settings/__tests__/settings-read-only.test.tsx`

<test_spec>
```typescript
// AC-1: Alle 5 Modes mit je 3 Slots angezeigt
it.todo('should render 5 mode sections with 3 slot rows each')

// AC-2: Aktiver Slot zeigt Model-Name und gruenen Dot
it.todo('should show model display name and green status dot for active slot')

// AC-3: Inaktiver Slot mit Model zeigt grauen Dot
it.todo('should show model display name and gray status dot for inactive slot')

// AC-4: Leerer Slot zeigt "not assigned"
it.todo('should show "not assigned" text and gray dot for slot with null modelId')

// AC-5: Keine editierbaren Elemente vorhanden
it.todo('should not render any Select dropdowns, Checkboxes, or change handlers')

// AC-6: Hint-Text wird angezeigt
it.todo('should display hint text "Change models in the workspace."')

// AC-7: Sync-Button funktioniert weiterhin
it.todo('should render Sync Models button that triggers sync flow')

// AC-8: Laedt Slots via getModelSlots statt getModelSettings
it.todo('should call getModelSlots on open and listen to model-slots-changed event')

// AC-9: Empty-State bei leerem Katalog
it.todo('should show empty state message when no models are synced')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-05-server-actions` | `getModelSlots()` | Server Action | Import kompiliert, liefert `ModelSlot[]` |
| `slice-02-db-queries` | `ModelSlot` | Type Export | Import kompiliert |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `SettingsDialog` (read-only) | React Component | Layout / Sidebar (bestehende Consumer) | `(props: { open: boolean, onOpenChange: (open: boolean) => void }) => JSX.Element` |
| `ModelModeSection` (read-only) | React Component | `SettingsDialog` (intern) | Props aendern sich: `slots: ModelSlot[]` statt `settings: ModelSetting[]`, kein `onModelChange` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `components/settings/settings-dialog.tsx` — MODIFY: `getModelSettings` durch `getModelSlots` ersetzen, `handleModelChange` entfernen, `onModelChange` Prop entfernen, Event-Listener auf `"model-slots-changed"` umstellen, Hint-Text hinzufuegen, DialogDescription anpassen
- [ ] `components/settings/model-mode-section.tsx` — MODIFY: Tier-Dropdowns durch Read-Only-Slot-Anzeige ersetzen (Slot-Label + Model-Name + Status-Dot), `onModelChange`-Prop entfernen, Props-Interface auf `ModelSlot[]` umstellen
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE neuen Dateien erstellen — nur bestehende Dateien modifizieren
- KEINE Aenderungen an der Sync-Logik (handleSync, NDJSON-Stream, Auto-Sync bleiben unveraendert)
- KEINE Aenderungen an anderen Settings-Dateien ausserhalb der 2 Deliverables
- KEINE Model-Editing-Faehigkeit behalten — alle Select/Dropdown/onChange Elemente werden entfernt
- KEIN Entfernen des `determineEmptyState`-Helpers — Empty-State-Logik bleibt bestehen (wird nur an Slots angepasst)

**Technische Constraints:**
- `getModelSlots()` aus `@/app/actions/model-slots` importieren (statt `getModelSettings` aus `model-settings`)
- `ModelSlot` Type aus `@/lib/db/queries` verwenden (hat `mode`, `slot`, `modelId`, `active`, `modelParams`)
- Model-Display-Name: `modelId` gegen geladene Models matchen (`models.find(m => m.replicateId === slot.modelId)?.name`); Fallback auf `modelId` wenn nicht im Katalog
- Status-Dot: Gruener Dot (`bg-green-500`) fuer `active: true`, Grauer Dot (`bg-gray-400`) fuer `active: false`
- Event-Name von `"model-settings-changed"` auf `"model-slots-changed"` umstellen (Dispatch nach Sync UND Listener)
- 3 Slots pro Mode (fest), nicht mehr tier-abhaengig (kein `TIERS_BY_MODE` mehr)
- `MODE_LABELS` Konstante beibehalten (unveraendert)

**Reuse:**

| Existing File | Usage in this Slice |
|---|---|
| `components/settings/settings-dialog.tsx` | Basis: Sync-Logik, Dialog-Struktur, Auto-Sync bleiben erhalten. Nur Data-Loading und Mode-Section-Rendering aendern |
| `components/settings/model-mode-section.tsx` | Basis: MODE_LABELS, determineEmptyState, Empty-State-Messages bleiben erhalten. Tier-Dropdowns werden durch Slot-Anzeige ersetzt |
| `app/actions/model-slots.ts` | Import: `getModelSlots` — ersetzt `getModelSettings` (aus Slice 05) |

**Referenzen:**
- Architecture: `specs/phase-7/2026-03-29-model-slots/architecture.md` → Section "Migration Map" → "Modified Files" (settings-dialog.tsx, model-mode-section.tsx)
- Wireframes: `specs/phase-7/2026-03-29-model-slots/wireframes.md` → Section "Screen: Settings Dialog (Read-Only)"
- Discovery: `specs/phase-7/2026-03-29-model-slots/discovery.md` → Section 2, Entscheidung "Settings-Dialog: Read-Only Anzeige"
