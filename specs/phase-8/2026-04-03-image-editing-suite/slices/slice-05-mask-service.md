# Slice 5: Mask Service

> **Slice 5 von 16** fuer `AI Image Editing Suite`

---

## Metadata (fuer Orchestrator)

| Key | Value |
|-----|-------|
| **ID** | `slice-05-mask-service` |
| **Test** | `pnpm test lib/services/__tests__/mask-service.test.ts` |
| **E2E** | `false` |
| **Dependencies** | `["slice-03-mask-canvas"]` |

---

## Test-Strategy (fuer Orchestrator Pipeline)

| Key | Value |
|-----|-------|
| **Stack** | `typescript-nextjs` |
| **Test Command** | `pnpm test lib/services/__tests__/mask-service.test.ts` |
| **Integration Command** | -- |
| **Acceptance Command** | `pnpm test -- --run` |
| **Start Command** | `pnpm dev` |
| **Health Endpoint** | `http://localhost:3000` |
| **Mocking Strategy** | `mock_external` (OffscreenCanvas / HTMLCanvasElement muessen gemockt werden fuer Node-Umgebung) |

---

## Ziel

Puren Frontend-Utility-Service erstellen, der vier Mask-Operationen bereitstellt: (1) RGBA-Canvas-ImageData zu Grayscale-PNG konvertieren, (2) 10px Gaussian-Blur Feathering auf Mask-Kanten anwenden, (3) Mask von Display-Aufloesung auf Original-Bildaufloesung skalieren, (4) Mask-Minimum-Size validieren. Der Service hat keine Side-Effects und arbeitet ausschliesslich auf Canvas-Daten.

---

## Acceptance Criteria

1) GIVEN ein `ImageData`-Objekt (100x100) mit roten Pixeln (rgba 255,0,0,128) in einem 30x30-Bereich und transparenten Pixeln im Rest
   WHEN `toGrayscalePng(imageData)` aufgerufen wird
   THEN wird ein `Blob` vom Typ `image/png` zurueckgegeben
   AND die PNG-Bilddaten enthalten weisse Pixel (rgb 255,255,255) wo die Quell-Pixel einen Alpha-Wert > 0 hatten
   AND schwarze Pixel (rgb 0,0,0) wo die Quell-Pixel Alpha = 0 hatten

2) GIVEN ein `ImageData`-Objekt (100x100) mit einer scharfkantigen Maske (harter Uebergang von Alpha 128 zu Alpha 0)
   WHEN `applyFeathering(imageData, radius)` mit `radius = 10` aufgerufen wird
   THEN enthaelt das zurueckgegebene `ImageData`-Objekt an den ehemaligen Kanten-Pixeln Alpha-Werte zwischen 1 und 127 (Gradient statt harter Kante)
   AND die Dimensionen des Outputs entsprechen exakt dem Input (100x100)

3) GIVEN ein `ImageData`-Objekt mit Dimensionen 500x400 (Display-Aufloesung)
   WHEN `scaleToOriginal(imageData, originalWidth, originalHeight)` mit `originalWidth = 1500` und `originalHeight = 1200` aufgerufen wird
   THEN hat das zurueckgegebene `ImageData`-Objekt die Dimensionen 1500x1200
   AND Pixel-Positionen werden proportional gemappt (Skalierungsfaktor 3x in beide Richtungen)

4) GIVEN ein `ImageData`-Objekt mit maskierten Pixeln (Alpha > 0) die eine Bounding Box von 15x20 Pixeln bilden
   WHEN `validateMinSize(imageData, minSize)` mit `minSize = 10` aufgerufen wird
   THEN wird `{ valid: true, boundingBox: { width: 15, height: 20 } }` zurueckgegeben

5) GIVEN ein `ImageData`-Objekt mit maskierten Pixeln die eine Bounding Box von 8x5 Pixeln bilden
   WHEN `validateMinSize(imageData, minSize)` mit `minSize = 10` aufgerufen wird
   THEN wird `{ valid: false, boundingBox: { width: 8, height: 5 } }` zurueckgegeben

6) GIVEN ein `ImageData`-Objekt ohne maskierte Pixel (alle Alpha = 0)
   WHEN `validateMinSize(imageData, minSize)` mit `minSize = 10` aufgerufen wird
   THEN wird `{ valid: false, boundingBox: { width: 0, height: 0 } }` zurueckgegeben

7) GIVEN ein `ImageData`-Objekt mit maskierten Pixeln
   WHEN `toGrayscalePng(imageData)` aufgerufen wird
   THEN ist der zurueckgegebene Blob groesser als 0 Bytes
   AND der Blob kann als gueltiges PNG-Bild dekodiert werden (PNG Magic Bytes: `89 50 4E 47`)

---

## Test Skeletons

> **Fuer den Test-Writer-Agent:** Jedes Test-Skeleton referenziert ein AC.
> Der Test-Writer implementiert die Assertions selbststaendig.

### Test-Datei: `lib/services/__tests__/mask-service.test.ts`

<test_spec>
```typescript
// AC-1: RGBA zu Grayscale-Konvertierung (weiss = maskiert, schwarz = unmaskiert)
it.todo('should convert RGBA ImageData to grayscale PNG with white for masked and black for unmasked pixels')

// AC-2: Feathering erzeugt Gradient an Kanten
it.todo('should apply 10px gaussian blur feathering producing gradient alpha values at mask edges')

// AC-3: Skalierung auf Original-Aufloesung
it.todo('should scale 500x400 ImageData to 1500x1200 when original dimensions are 1500x1200')

// AC-4: Validation akzeptiert Maske >= 10px Bounding Box
it.todo('should return valid true for mask with bounding box 15x20 when minSize is 10')

// AC-5: Validation lehnt Maske < 10px ab
it.todo('should return valid false for mask with bounding box 8x5 when minSize is 10')

// AC-6: Validation lehnt leere Maske ab
it.todo('should return valid false with zero bounding box when no masked pixels exist')

// AC-7: PNG-Output hat valide PNG-Signatur
it.todo('should produce a Blob with valid PNG magic bytes and size greater than zero')
```
</test_spec>

---

## Integration Contract

### Requires From Other Slices

| Slice | Resource | Type | Validation |
|-------|----------|------|------------|
| `slice-03-mask-canvas` | `state.maskData: ImageData \| null` | State Field | MaskCanvas liefert ImageData via `SET_MASK_DATA` Dispatch |

### Provides To Other Slices

| Resource | Type | Consumer | Interface |
|----------|------|----------|-----------|
| `toGrayscalePng` | Function | slice-07 (Inpaint Integration) | `(imageData: ImageData) => Promise<Blob>` |
| `applyFeathering` | Function | slice-07 (Inpaint Integration) | `(imageData: ImageData, radius: number) => ImageData` |
| `scaleToOriginal` | Function | slice-07 (Inpaint Integration) | `(imageData: ImageData, originalWidth: number, originalHeight: number) => ImageData` |
| `validateMinSize` | Function | slice-07, slice-09 (Erase Flow) | `(imageData: ImageData, minSize: number) => { valid: boolean, boundingBox: { width: number, height: number } }` |

---

## Deliverables (SCOPE SAFEGUARD)

<!-- DELIVERABLES_START -->
- [ ] `lib/services/mask-service.ts` — Neuer Utility-Service mit 4 Funktionen: `toGrayscalePng`, `applyFeathering`, `scaleToOriginal`, `validateMinSize`
<!-- DELIVERABLES_END -->

> **Hinweis:** Test-Dateien gehoeren NICHT in Deliverables. Der Test-Writer-Agent erstellt Tests basierend auf den Test Skeletons oben.

---

## Constraints

**Scope-Grenzen:**
- KEINE R2-Upload-Logik (das passiert im Consumer slice-07)
- KEINE Integration mit CanvasDetailState oder UI-Komponenten
- KEINE Side-Effects — alle Funktionen sind pure (Input -> Output)
- KEIN Mask-Zeichnen oder Canvas-Rendering (das ist Slice 03)
- KEINE Aufrufe von externen APIs

**Technische Constraints:**
- Feathering via Canvas 2D `filter: blur(10px)` auf einem Offscreen-Canvas (siehe architecture.md → Technology Decisions Zeile 444)
- Grayscale-Konvertierung: Alpha > 0 → weiss (255), Alpha = 0 → schwarz (0). Kein Graustufen-Mapping — binaere Entscheidung vor dem Feathering
- Skalierung via Offscreen-Canvas `drawImage` mit Ziel-Dimensionen (Hardware-beschleunigt)
- PNG-Export via `canvas.toBlob('image/png')` oder `OffscreenCanvas.convertToBlob({ type: 'image/png' })`
- Bounding-Box-Berechnung: Iteriere ueber ImageData-Pixel, finde min/max x/y mit Alpha > 0
- Alle Funktionen muessen im Browser-Kontext lauffaehig sein (keine Node-only APIs)

**Referenzen:**
- Architecture: `architecture.md` → Section "Services & Processing" (Zeile 150: MaskService Definition)
- Architecture: `architecture.md` → Section "Technology Decisions" (Zeile 443-445: Canvas 2D API, Feathering-Strategie, Export)
- Architecture: `architecture.md` → Section "NFRs" (Zeile 397: 10px Gaussian Blur Feathering)
- Architecture: `architecture.md` → Section "Validation Rules" (Zeile 212: Mask Minimum Size >= 10px)
- Architecture: `architecture.md` → Section "Data Flow" (Zeile 277: MaskCanvas → MaskService → R2 Pipeline)
- Discovery: `discovery.md` → Business Rules (Zeile 282-283: Mask-Format Grayscale PNG, weiss=Edit, schwarz=Beibehalten)
- Discovery: `discovery.md` → Business Rules (Zeile 301: Mask-Export Skalierung Display → Original)
