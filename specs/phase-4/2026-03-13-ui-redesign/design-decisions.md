# Design Decisions: UI Redesign — AI Factory

**Status:** Final
**Modus:** Exploration → Fokus
**Medium:** Pencil (.pen)
**Datum:** 2026-03-13

---

## Design Context

### Design System

| Aspekt | Status |
|--------|--------|
| Design System vorhanden | Nein (shadcn/ui Default — zu generisch) |
| Umfang | CSS Variables + shadcn/ui Preset (kein eigenes DS) |
| DS-Erstellung im Scope | Ja — neues Token-System definiert |

### Tone & Direction

> **"Swiss Dark Warm"** — Systematische Typografie-Hierarchie (Accent Lines vor Headlines) trifft warmen Gradient-Akzent. Dark-First mit vollständiger Light-Mode-Parität. Ein Accent-Token-Set für beide Themes. Kein Card-Stacking im Panel. Wirkt wie ein professionelles Creative Studio Tool, nicht wie ein generisches SaaS-Dashboard.

### Erkenntnisse aus dem Explorationsprozess

- 3 Richtungen evaluiert: Electric Neon (Lime), Editorial Elegance (Serif+Multi-Accent), Swiss Bold (Red)
- Swiss Bold Systematik überzeugt durch Lesbarkeit und Struktur (rote Accent Lines als visuelle Anker)
- Electric Neon Gradient-Prinzip übertragen (Gradient Primary statt Solid)
- Farbe: Rose→Peach (#ee3257 → #fa9a66) — wärmer und gender-neutraler als Lime oder Red
- Dark und Light Mode teilen exakt dieselben Accent-Farben → ein Farbsystem, zwei Themes

---

## Design System — Token-Referenz

### Accent (theme-invariant)

| Token | Wert | Verwendung |
|-------|------|------------|
| `--color-accent` | `#ee3257` | Solid: Lines, Icons, Links |
| `--color-accent-gradient-from` | `#ee3257` | Gradient Start (Rose) |
| `--color-accent-gradient-to` | `#fa9a66` | Gradient End (Peach) |
| `--text-on-accent` | `#FFFFFF` | Text auf Primary-Flächen |

**Gradient-Definition:** `linear-gradient(180deg, #ee3257, #fa9a66)`
Verwendet auf: Generate Button, Active Mode Segment, @1 Badge

### Surfaces & Backgrounds

| Token | Dark | Light |
|-------|------|-------|
| `--bg-base` | `#0C0C0C` | `#FAFAF9` |
| `--bg-surface` | `#1A1A1A` | `#FFFFFF` |
| `--bg-input` | `#262626` | `#E0E0DC` |

### Borders

| Token | Dark | Light |
|-------|------|-------|
| `--border-subtle` | `#3A3A3A` | `#C8C8C5` |
| `--border-default` | `#2A2A2A` | `#E5E5E3` |
| `--border-strong` | `#3F3F46` | `#D5D5D3` |

### Text

| Token | Dark | Light |
|-------|------|-------|
| `--text-primary` | `#FFFFFF` | `#1C1C1C` |
| `--text-secondary` | `#8A8A8A` | `#6A6A6A` |
| `--text-muted` | `#525252` | `#9A9A9A` |

### Typography

| Token | Wert | Verwendung |
|-------|------|------------|
| `--font-display` | `Sora` | Headlines, Labels, Zahlen |
| `--font-body` | `Inter` | Body Text, Inputs, Meta |

### Border Radius

| Token | Wert | Verwendung |
|-------|------|------------|
| `--radius-sm` | `4px` | Badges, Chips, Checkboxen |
| `--radius-md` | `6px` | Inputs, Buttons, Cards |
| `--radius-lg` | `8px` | Modal, Segmented Control |

---

## Screen Decisions

### Screen: Workspace — Prompt Panel (Image to Image)

**Ist-Zustand:** Standard shadcn/ui, weiß, flach, keine visuelle Persönlichkeit. UI verschwindet hinter dem Content.

#### Style-Analyse (Ist)

| Aspekt | Existierender Wert | Problem |
|--------|--------------------|---------|
| Background | `#FFFFFF` | Klinisch, keine Atmosphäre |
| Primary | `oklch(0.54 0.27 289)` — Blue-Purple | Generisch, austauschbar |
| Font | Geist Sans | Funktional, keine Persönlichkeit |
| Mode Selector | shadcn Segmented | Zu wenig Kontrast gegen Hintergrund |
| Reference Card | Flat, light border | Selects kaum lesbar |
| Generate Button | Solid Purple | Kein visuelles Gewicht |

#### Entschiedene Variante: Swiss Dark Warm

**Gewählte Variante:** Swiss Dark Warm (Dark Mode Default)

**Begründung:** Swiss Bold Systematik (Accent Lines, UPPERCASE Labels) gibt dem Panel klare Orientierung ohne Karten-Stacking. Gradient Primary erzeugt visuelles Gewicht auf CTA. Dark Canvas lässt die generierten Bilder in der Gallery besser strahlen.

**Anpassungen gegenüber Swiss Bold:**
- Farbe: Red (#FF3B30) → Rose-Peach Gradient (#ee3257 → #fa9a66) — wärmer, breiter ansprechend
- Font: Beibehaltung Sora + Inter (Swiss Bold Fonts)
- Weißer Text auf Primary-Flächen (beide Modes)
- Kein Card-Layout im Panel — flat, mit Separatoren und Spacing

#### Layout-Beschreibung

```
┌─────────────────────────────────────────┐
│  [Text to Image] [►Image to Image◄] [Upscale]  ← Gradient Active Tab
├─────────────────────────────────────────┤
│  Prompt    History    Favorites          ← Tab mit Accent Underline
├─── ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ──┤
│  ── MODEL                               ← Accent Line + UPPERCASE Label
│  [img] flux-2-pro                       ←  +4px spacing über jedem Label
│        black-forest-labs
│  Browse Models                          ← Accent Color Link
├─────────────────────────────────────────┤
│  ── REFERENCES              [+ Add]     ← [1/5] Badge
│  ┌─────────────────────────────────┐    ← Dark Surface Card
│  │ [thumb] [@1]  [Content]    [x]  │
│  │         [Content ▾] [Moderate ▾]│    ← Helle Schrift auf #0C0C0C
│  └─────────────────────────────────┘
│  [  Drop image here...           ]      ← Dashed Dropzone
├─────────────────────────────────────────┤
│  ── PROMPT                              ← Accent Line
│  Motiv *                                ← Sora Bold
│  [  A futuristic cityscape...    ]      ← Active: Accent Ring + Glow
│  [✦ Assistent]  [✦ Improve]
│  Style / Modifier
│  [  Add style, mood...           ]
├─────────────────────────────────────────┤
│  ── PARAMETERS                   [›]
│  Variants                    [−] 1 [+]
├─────────────────────────────────────────┤
│  [        Generate          ]           ← Gradient CTA
└─────────────────────────────────────────┘
```

---

## Constraints für Wireframe Agent

| Constraint | Wert | Screen |
|------------|------|--------|
| Font Display | Sora | Alle Screens |
| Font Body | Inter | Alle Screens |
| Accent System | `#ee3257 → #fa9a66` gradient | Global |
| Accent Lines | 24×2px `#ee3257` vor UPPERCASE Section Labels | Workspace, Settings |
| Section Labels | Inter 11px, 700, `#--text-secondary`, letterSpacing 2 | Workspace |
| Mode Selector | `--bg-input` mit `--border-subtle` Stroke, Radius 8px | Workspace |
| Active Mode | Gradient Fill + Weiße Schrift | Workspace |
| Active Tab | 2px Accent Bottom Border | Workspace |
| Active Input Ring | 2px Accent Border + Glow Shadow `#ee325733` | Workspace |
| Reference Card | `--bg-surface`, dunkle Select-Hintergründe (`--bg-base`) | Workspace |
| Select Contrast | `--text-primary` auf `--bg-base` mit `--border-strong` | Reference Card |
| CTA Button | Gradient + `--text-on-accent` + Radius `--radius-md` | Workspace, Home |
| Spacing vor Labels | 4px extra Spacer vor jedem Section Label | Workspace |
| Light/Dark Parität | Alle Accent-Werte identisch, nur Surfaces/Text wechseln | Global |

---

## Completeness Check

| Check | Status |
|-------|--------|
| Style-Analyse Ist-Zustand durchgeführt | ✅ Screenshots + DevTools |
| 3 Varianten evaluiert und entschieden | ✅ |
| Dark + Light Mode entschieden | ✅ |
| Token-System definiert | ✅ Pencil Variables + CSS-Tokens |
| Workspace Prompt Panel entschieden | ✅ |
| Home Screen (Projects) | ⬜ Noch ausstehend |
| Workspace Gallery | ⬜ Noch ausstehend |
