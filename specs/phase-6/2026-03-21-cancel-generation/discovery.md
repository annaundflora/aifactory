# Feature: Cancel Generation

**Epic:** --
**Status:** Ready
**Wireframes:** --

---

## Problem & Solution

**Problem:**
- Laufende Generations koennen nicht abgebrochen werden
- Fehlgestartete oder ungewollte Generations verbrauchen Replicate-Rechenzeit bis zum Ende
- User muss warten bis Generation fertig oder fehlgeschlagen ist

**Solution:**
- Cancel-Button auf dem Generation-Placeholder
- Server-seitig: Replicate Prediction abbrechen via `predictions.cancel()`
- DB-Eintrag loeschen, Placeholder verschwindet

**Business Value:**
- Kostenersparnis: Unnoetige Replicate-Rechenzeit wird gestoppt
- Bessere UX: User hat Kontrolle ueber laufende Prozesse

---

## Scope & Boundaries

| In Scope |
|----------|
| Cancel-Button auf einzelnem Generation-Placeholder |
| Replicate Prediction abbrechen via API |
| DB-Eintrag loeschen nach Cancel |
| Placeholder verschwindet nach Cancel |
| PredictionId frueh speichern (vor `client.wait()`) |

| Out of Scope |
|--------------|
| Batch-Cancel (alle laufenden Generations auf einmal) |
| Automatisches Cancel bei Navigation/Page-Leave |
| Cancel in der Detail-View |
| Cancel-History / Auswertung |

---

## Current State Reference

- `GenerationPlaceholder` zeigt Loading-Spinner fuer pending Generations (`generation-placeholder.tsx`)
- Fire-and-forget Pattern in `generation-service.ts`: `processGeneration()` laeuft async
- `replicatePredictionId` wird erst NACH Abschluss in DB gespeichert (Zeile 232)
- Replicate SDK v1.4.0: `client.predictions.cancel(id)` existiert
- `deleteGeneration(id)` existiert in `queries.ts`
- Polling alle 3s in `workspace-content.tsx` aktualisiert Generations-State

---

## UI Patterns

### Reused Patterns

| Pattern Type | Component | Usage in this Feature |
|--------------|-----------|----------------------|
| Placeholder Card | `generation-placeholder.tsx` | Cancel-Button wird hinzugefuegt |
| Icon Button | lucide `X` Icon | Cancel-Button Styling |

### New Patterns

| Pattern Type | Description | Rationale |
|--------------|-------------|-----------|
| Cancel Overlay on Placeholder | X-Button oben rechts auf dem Loading-Placeholder | Kein existierendes Pattern fuer Cancel auf Placeholdern |

---

## User Flow

1. User startet Generation -> Placeholder mit Spinner erscheint
2. User hoverd ueber Placeholder -> X-Button erscheint (oben rechts)
3. User klickt X-Button -> Button zeigt kurz Loading-State
4. Server bricht Replicate Job ab + loescht DB-Eintrag
5. Placeholder verschwindet aus der Galerie

**Error Paths:**
- Replicate Cancel schlaegt fehl (Job bereits fertig) -> Generation wird trotzdem aus DB geloescht, Placeholder verschwindet
- Netzwerkfehler -> Toast "Abbrechen fehlgeschlagen", Placeholder bleibt

---

## UI Components & States

| Element | Type | Location | States | Behavior |
|---------|------|----------|--------|----------|
| Cancel-Button | Icon Button (X) | Placeholder, oben rechts | `hidden` (default), `visible` (hover), `loading` (nach Klick) | Hover zeigt Button, Klick triggert Cancel |

---

## Business Rules

- Cancel ist nur moeglich fuer Generations mit Status `pending`
- Nach Cancel: DB-Eintrag wird geloescht (kein "canceled" Status)
- Replicate Job wird best-effort abgebrochen (wenn Cancel fehlschlaegt, wird DB trotzdem bereinigt)
- `replicatePredictionId` muss direkt nach `predictions.create()` in DB gespeichert werden (vor `client.wait()`)

---

## Data

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `replicatePredictionId` | Ja (neu: frueh gespeichert) | UUID-String | Wird jetzt direkt nach `predictions.create()` gespeichert, nicht erst nach Completion |

---

## Implementation Slices

### Dependencies

```
Slice 1 -> Slice 2 -> Slice 3
```

### Slices

| # | Name | Scope | Testability | Dependencies |
|---|------|-------|-------------|--------------|
| 1 | PredictionId frueh speichern | `replicateRunCore()` gibt predictionId zurueck nach `create()`, `processGeneration()` speichert sie in DB vor `wait()` | Unit-Test: DB hat predictionId waehrend Generation laeuft | -- |
| 2 | Cancel Server Action | Neue `cancelGeneration` Server Action: liest predictionId aus DB, ruft `predictions.cancel()`, loescht DB-Eintrag | Unit-Test: Action bricht Prediction ab und loescht Eintrag | Slice 1 |
| 3 | Cancel UI | X-Button auf Placeholder (Hover), ruft Cancel Action, Placeholder verschwindet | Manueller Test: Button erscheint, Cancel funktioniert | Slice 2 |

### Recommended Order

1. **Slice 1:** PredictionId frueh speichern -- Voraussetzung, damit Cancel die Replicate-ID kennt
2. **Slice 2:** Cancel Server Action -- Backend-Logik, testbar ohne UI
3. **Slice 3:** Cancel UI -- Button + Integration

---

## Context & Research

### Similar Patterns in Codebase

| Feature | Location | Relevant because |
|---------|----------|------------------|
| Retry Generation | `generation-placeholder.tsx:149-172` | Aehnliches Button-Pattern auf Placeholder |
| Delete Generation | `app/actions/generations.ts` | Loescht DB-Eintrag, aehnlicher Flow |
| Stale Pending Cleanup | `lib/db/queries.ts:failStalePendingGenerations` | Markiert stuck Generations, Cancel ersetzt diesen Bedarf teilweise |

### Web Research

| Source | Finding |
|--------|---------|
| Replicate SDK v1.4.0 | `client.predictions.cancel(id)` -- POST `/predictions/{id}/cancel`, Status wird "canceled" |
| Replicate Changelog 2025-10 | `Cancel-After` Header fuer automatische Deadlines (nicht relevant fuer manuellen Cancel) |
| Replicate SDK TypeScript Defs | Status-Typ: `"starting" \| "processing" \| "succeeded" \| "failed" \| "canceled" \| "aborted"` |

---

## Open Questions

Keine offenen Fragen.

---

## Q&A Log

| # | Frage | Antwort |
|---|-------|---------|
| 1 | Welchen Scope hat das Cancel-Feature? Einzelne Generation, Batch oder beides? | Einzelne Generation abbrechen nach dem Starten |
| 2 | Wo soll der Cancel-Button erscheinen? Auf dem Placeholder oder im Spinner? | Auf dem Placeholder (X-Button) |
| 3 | Kann man den Job auch bei Replicate abbrechen? | Ja, Replicate SDK hat `predictions.cancel(id)` -- stoppt den Job und spart Kosten |
| 4 | Was soll nach dem Cancel in der UI passieren? | Placeholder verschwindet sofort |
| 5 | Soll der DB-Eintrag geloescht oder als "canceled" behalten werden? | Loeschen, kein Rueckstand in der DB |
| 6 | Discovery-Tiefe? | Kompakt -- Feature ist ueberschaubar |
