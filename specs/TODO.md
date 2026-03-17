# TODO

## High Priority

- [x] **Drag & Drop via Touch** — Touch-basiertes Drag & Drop implementieren (z.B. iPad-Support)
- [x] **Download Bug auf Production fixen** — Domain in R2 Storage Cors Settings erlauben
- [ ] **Tooltips fuer UI-Elemente** — Erklaerungen zu UI-Elementen und Tools via Tooltips anzeigen

- [x] **Canvas Bild-Details: Style/Negative fehlen** — Style und Negative Prompt werden in den Bild-Details auf dem Canvas nicht angezeigt
- [ ] **Assistent: Prompt als Kontext mitsenden** — Bei text-to-image soll der Assistent nicht nur das Bild als Referenz erhalten, sondern auch den zugehoerigen Prompt

- [ ] **Assitent & Cnavas Chat session speichern (langgraph Checkpoints)** — Chat Sessions speichern und damit später weiter führen können


- [ ] **Textarea Auto-Resize bei programmatischen Wertaenderungen** — Wenn Eingabefelder in der Prompt Area automatisch befuellt werden (z.B. History-Auswahl, Variation Popover, LLM Improve), passt sich die Textarea-Hoehe nicht an den Inhalt an. Nur bei manuellem Tippen/Pasten funktioniert das Resizing. Bisherige Versuche: `field-sizing-content` CSS, `useLayoutEffect` + `requestAnimationFrame` — beides ohne Erfolg.

## Medium Priority

- [x] **Varianten-Verschiedenheit fixen** — Kreativitaet/Diversity der generierten Varianten verbessern
- [ ] **Vitest Test-Suite reparieren** — 17 failing files / 109 failed tests / 1586 passed (Stand 2026-03-16). Details:
  - Infra-Tests (slice-13/14 Caddy/Docker) bereits geloescht — irrelevant fuer CI
  - `next-auth` ESM-Import gefixt via `vitest.config.ts` (resolve.alias + server.deps.inline)
  - Globaler Auth/DB-Mock in `vitest.setup.ts` eingefuehrt — kollidiert mit Auth-Tests (29 fails) und ist zu simpel fuer DB-Tests (52 fails)
  - UI-Tests veraltet gegenueber aktuellen Komponenten (sidebar, workspace-layout, img2img-popover — 33 fails)
  - 5 Einzel-Failures (schema-Spalten, Migration, TS-Build, etc.)
  - Naechster Schritt: Globale Mocks entfernen, stattdessen fehlende `vi.mock('@/lib/auth/guard')` in ~30 Test-Files einzeln einfuegen
