---
title: Vision
created: 2026-03-02
updated: 2026-03-02
---

# Vision: POD Design Studio

## Was ist POD Design Studio?

Ein AI-gestütztes Design-Tool, das Bildmodelle von Replicate.com anbindet, um schnelle Design-Iterationen für Print-on-Demand zu ermöglichen. Optimiert für den eigenen Workflow: Prompt eingeben, iterieren, bearbeiten, in 4000x4000px POD-ready exportieren.

## Kernproblem

Der Weg von "Idee" zu "druckfertiges POD-Design" erfordert heute zu viele Tools und zu viele manuelle Schritte. Kittl kommt nah dran, ist aber nicht auf den eigenen Workflow optimiert und bietet keine Kontrolle über die verwendeten AI-Modelle.

## Zielgruppe

Ich selbst. Ein persönliches Power-Tool für meinen POD-Workflow (Spreadshirt).

## Erfolg sieht so aus

- Ich kann in unter 5 Minuten von einer Idee zu einem druckfertigen 4000x4000px Design kommen
- Ich kann flexibel zwischen verschiedenen Replicate-Modellen wechseln (FLUX, SDXL, etc.)
- Der Prompt-Assistent hilft mir, schneller zum gewünschten Ergebnis zu kommen
- Bearbeitungstools (Upscaling, Background-Removal, Inpainting, Text, Layers) sind direkt integriert
- Export ist auf Spreadshirt-Anforderungen optimiert

## Tech-Stack
- **Frontend/Backend:** Next.js (App Router, TypeScript, Tailwind v4)
- **Datenbank:** PostgreSQL in Docker
- **Bild-Storage:** Cloudflare R2
- **AI-Modelle:** Replicate API (FLUX, SDXL, etc.)
- **LLM:** OpenRouter API (Default: `openai/gpt-oss-120b:exacto`)

---
*Letzte Aktualisierung: 2026-03-02*
