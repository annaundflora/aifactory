# Bug: Multi-Model Generation schlaegt fehl durch Replicate Rate Limiting

**Entdeckt:** 2026-03-11
**Status:** ✅ Behoben
**Priority:** Hoch
**Location:** `lib/services/generation-service.ts:196-227`

---

## Problembeschreibung

Bei Multi-Model Generation (2-3 Models gleichzeitig) wurden alle Replicate API-Calls parallel via `Promise.allSettled` abgefeuert. Dies fuehrte zu 429 Rate Limit Errors bei Replicate, sodass nur 1 von 3 Bildern generiert wurde.

## Reproduktion

1. Workspace oeffnen
2. Browse Models -> 3 verschiedene Models auswaehlen -> Confirm
3. Prompt eingeben -> Generate
4. 3 Loading-Placeholders erscheinen
5. Nur 1 Bild wird fertig, 2 schlagen fehl mit "Zu viele Anfragen"

## Erwartetes Verhalten

- Alle 3 ausgewaehlten Models erzeugen je 1 Bild

## Tatsaechliches Verhalten

- Nur 1 Bild wurde generiert
- 2 Generierungen schlugen fehl: `Zu viele Anfragen. Bitte kurz warten.`
- Zusaetzlich: 1 Model (`prunaai/sdxl-lightning`) lieferte 404 (stale Collection-Eintrag)

## Test-Evidenz

- Server-Console: `Generation xxx fehlgeschlagen: Zu viele Anfragen. Bitte kurz warten.`
- Replicate Dashboard: nur 1 Job sichtbar
- Error-Toasts im UI korrekt angezeigt

## Fix

Multi-Model-Branch von paralleler (`Promise.allSettled`) auf sequentielle Verarbeitung umgestellt — identisch zur bestehenden Single-Model-Logik (`for...of` Loop).

**Geaenderte Dateien:**
- `lib/services/generation-service.ts` (Zeile 196-210)
- `lib/services/__tests__/generation-service.test.ts` (Kommentare aktualisiert)

**Tests:** Alle 19 Tests bestanden nach Fix.

## Nebenfund: Stale Collection Models

`prunaai/sdxl-lightning` wird von der Replicate Collections API zurueckgegeben, existiert aber nicht mehr (404). Dies ist ein externes Datenproblem, kein Code-Bug. Kein Fix erforderlich.
