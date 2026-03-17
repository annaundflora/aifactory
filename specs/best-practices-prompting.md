# AI Image Prompt Engineering: Der definitive Leitfaden für alle Top-Modelle

**Die wichtigste Erkenntnis aus über 50 professionellen Quellen und Community-Tests: Der Paradigmenwechsel im AI-Prompting ist vollzogen.** Keyword-Spam ("8k, masterpiece, best quality, ultra detailed") ist bei modernen Modellen wie Flux 2, Midjourney V7 und GPT-4o nicht nur nutzlos – er verschlechtert aktiv die Ergebnisse. Stattdessen dominiert natürliche Sprache kombiniert mit technischen Fotografiebegriffen. Der entscheidende Unterschied zwischen Amateur- und Profi-Ergebnissen liegt nicht in der Prompt-Länge, sondern darin, generische Adjektive ("amazing, beautiful, stunning") durch **konkrete Kamera-, Objektiv- und Lichtangaben** zu ersetzen: "Shot on Sony A7R IV, 85mm f/1.4, Rembrandt lighting" übertrifft "ultra realistic, highly detailed" bei jedem getesteten Modell. Dieser Guide deckt bewährte Techniken für Flux 2 Pro/Max, Midjourney V7, GPT-4o, Stable Diffusion 3.5, Ideogram, Recraft V3, Adobe Firefly 3, Hunyuan Image 3 und Nano Banana 2 ab – mit konkreten Beispiel-Prompts für zehn professionelle Use Cases.

---

## Die Anatomie eines perfekten Prompts folgt einer klaren Hierarchie

Jeder professionelle Prompt besteht aus bis zu elf Schichten, wobei die **Reihenfolge entscheidend** ist – alle modernen Modelle gewichten frühere Tokens stärker. Die optimale Universalstruktur lautet:

**Subject → Action/Pose → Medium/Style → Setting/Context → Lighting → Camera/Lens → Mood/Atmosphere → Color Palette → Composition → Rendering → Quality Tags**

Das **Subject** steht immer an erster Stelle. Nicht "A beautiful cinematic photo of a woman" sondern "A mid-30s woman with shoulder-length auburn hair, wearing a beige linen blazer" – die Spezifität des Subjects bestimmt die Qualität des gesamten Bildes. Das **Medium** (Fotografie, Ölgemälde, Digitalillustration, 3D-Render) setzt den tonalen Rahmen für alles Folgende. **Lighting** ist nach Community-Konsens das wirkungsvollste einzelne Element: "Rembrandt lighting with soft fill from camera left" erzeugt dramatisch bessere Ergebnisse als jedes Quality-Tag. **Camera/Lens-Spezifikationen** fungieren als Portale zu spezifischen Trainingsdaten – "85mm f/1.4" aktiviert tausende professionelle Portraitfotos, "shot on Hasselblad X2D" ruft Fashion- und Fine-Art-Ästhetik ab. **Rendering-Engine-Referenzen** wie "Unreal Engine 5" oder "Octane Render" pushen Bilder in Richtung hyperrealistischer 3D-Optik und sind besonders wirksam für Sci-Fi und Fantasy.

Der Sweet Spot für die Prompt-Länge liegt bei **30–80 Wörtern** für die meisten Modelle und Use Cases. Kurze Prompts (10–30 Wörter) eignen sich für explorative Phasen; sehr lange Prompts (100+ Wörter) riskieren bei älteren Modellen die Verwässerung der Token-Gewichtung, funktionieren aber hervorragend mit Flux 2 und Hunyuan Image 3.

Die Modellunterschiede in der Prompt-Struktur sind erheblich: Stable Diffusion 1.5/SDXL bevorzugt Komma-getrennte Keywords mit Gewichtungssyntax `(keyword:1.3)`; Midjourney V7 und Flux arbeiten am besten mit natürlichen Sätzen; DALL-E 3 nutzt ChatGPTs automatische Prompt-Augmentierung; und **SD 3.5 ignoriert Keyword-Weighting komplett** – `(term:1.3)`, `[[term]]` und `BREAK` haben null Effekt auf dieses Modell.

---

## Flux 2 Pro/Max: Der technische Präzisionsmeister

Flux ist das Modell, das **Prompt-Treue über alles** stellt. Gebaut auf **32 Milliarden Parametern** mit einem Dual-Encoder-System (T5 für natürliches Sprachverständnis + CLIP für visuelle Konzeptausrichtung), versteht Flux Beziehungen zwischen Beschreibungen wie kein anderes Modell. Das offizielle Prompting-Framework von Black Forest Labs lautet: Subject + Action + Style + Context. Word Order ist hier besonders kritisch – was am Anfang steht, erhält die meiste Aufmerksamkeit.

**Flux 2 Max** ist der Premium-Tier mit bis zu **4MP Output-Auflösung**, bis zu 10 Referenzbildern gleichzeitig und Web-Grounded Generation für aktuelle Kontexte. **Flux 2 Pro** ist der Production-Workhorse mit LoRA-Fine-Tuning-Support und automatischem Prompt-Upsampling. Die zentrale Erkenntnis: Steps und Guidance sind bei Pro/Max **intern optimiert und nicht manuell einstellbar** – das Modell weiß selbst, was optimal ist.

Was Flux einzigartig macht: **HEX-Farbcode-Unterstützung** ermöglicht exakte Markenfarben ("walls in hex #C4725A"), **JSON-strukturiertes Prompting** erlaubt komplexe Szenensteuerung mit Camera-Angle, f-Number und Subject-Positioning, und die **Textrendering-Fähigkeit** liegt bei circa 60% Genauigkeit beim ersten Versuch für komplexe Typografie – deutlich besser als Midjourney oder Stable Diffusion.

Die größte Falle bei Flux: **Quality-Tags wie "8k ultra HD masterpiece" verschwenden Token-Aufmerksamkeit.** Blind-Vergleiche der Community zeigen keinen konsistenten Qualitätsunterschied mit oder ohne diese Tags. Stattdessen funktionieren **spezifische technische Deskriptoren**: "Shot on Sony A7IV with 85mm f/1.8 lens" statt "professional photography". Film-Stock-Referenzen ("Kodak Portra 400") produzieren authentischere Ergebnisse als generische Beschreibungen. Flux unterstützt **keine nativen Negative Prompts** auf Pro/Max – die Lösung ist positive Umformulierung: "sharp focus throughout" statt "no blur".

Beispiel-Prompt für Flux (Cinematic):
> "Anthropomorphic penguin in disheveled formal wear hunched on worn leather bar stool, dimly lit neighborhood bar, shot on 35mm film f/2.8, 50mm lens, practical lighting from overhead warm bar lamps and neon signs, film grain, slight desaturation, Rembrandt lighting creating dramatic face shadows, half-empty whiskey glass in sharp focus, blurred bottles background, melancholic atmosphere, rule of thirds"

---

## Midjourney V7 hat die Spielregeln grundlegend verändert

V7 markiert den vollständigen Bruch mit Keyword-basiertem Prompting. Alte Techniken ("beautiful, stunning, 8k, detailed, masterpiece") **verschlechtern aktiv die Ergebnisse** – das Modell versteht natürliche Sprache so gut, dass generische Qualitätswörter nur als Rauschen interpretiert werden. Die empfohlene Hierarchie: Subject mit Details → Context/Setting → Style/Mood → Technical → Parameter.

Die **Parameter-Landschaft** von Midjourney ist die reichhaltigste aller Modelle. `--stylize` (0–1000, Default 100) kontrolliert die künstlerische Interpretation: niedrige Werte für Fotorealismus, hohe für den charakteristischen MJ-Look. `--chaos` (0–100) steuert die Variation zwischen den vier generierten Bildern. `--style raw` entfernt Midjourneys ästhetische Standardinterpretation für literalere, fotografischere Ergebnisse – **der wichtigste einzelne Parameter für realistische Portraits**.

V7 ersetzt `--cref` (Character Reference) durch **`--oref` (Omni Reference)** mit `--ow` Gewichtung (0–1000). Der Sweet Spot für Charakter-Konsistenz liegt bei **--ow 200–400**. Für Style-Transfers bei gleichzeitiger Feature-Beibehaltung empfiehlt sich --ow 25. Die **Style Reference `--sref`** erhält in V7 sechs Interpretations-Versionen (--sv 1-6) und kann mit numerischen Style-Codes verwendet werden – durchsuchbare Datenbanken mit 1600+ getesteten Codes existieren auf srefs.co und promptsref.com.

Das **Multi-Prompting mit `::`** bleibt ein mächtiges Werkzeug: `mountain landscape::2 sunset::1 lone figure::0.5` gibt dem Berg vierfache Priorität gegenüber der einsamen Figur. Negative Gewichte (`element::-0.5`) sind feiner als `--no` und erlauben Abstufungen. Die Community-getestete Best Practice mit 3.400 Upvotes auf r/midjourney: "Stop trying to write the perfect prompt on the first try. Short prompt, pick the best of 4, then add detail to that direction."

---

## GPT-4o und gpt-image-1.5 setzen auf konversationelle Iteration

Die OpenAI-Modellreihe funktioniert fundamental anders: **autoregressive Token-für-Token-Generierung** statt Diffusion. Das bedeutet präziseres Prompt-Following (10–20 Objekte mit enger Attribut-Bindung vs. 5–8 bei DALL-E 3) und die Fähigkeit zur **konversationellen Verfeinerung** innerhalb einer Chat-Session. Die offizielle Prompt-Struktur lautet: Background/Scene → Subject → Key Details → Constraints → Intended Use. Das Benennen des Verwendungszwecks ("for a billboard ad", "for a mobile UI mockup") **setzt den Qualitätsmodus und Detailgrad**.

GPT-4o's Signature-Vorteil ist **Textrendering in Bildern** – nahezu perfekt lesbar. Best Practices dafür: Text in Anführungszeichen oder GROSSBUCHSTABEN setzen, "EXACT, verbatim, no extra characters" hinzufügen, schwierige Wörter buchstabieren ("S-P-E-C-I-A-L"), und bei Quality-Setting `high` bleiben für textlastige Layouts.

Das neueste API-Modell **gpt-image-1.5** (Dezember 2025) bietet die Parameter `quality` (low/medium/high), `input_fidelity` (für Edit-Treue), `background: "transparent"` für Freisteller, und Ausgabeformate einschließlich RGBA-PNG. Kritische Schwächen: Bilder tendieren dazu, **zu dunkel** zu werden (Workaround: explizite Lichtquellen beschreiben), ein **Post-Processing "Structure Enhancer"** kann Verzerrungen verursachen, und die generelle Ästhetik kann "dull and uninspiring" wirken verglichen mit DALL-E 3's kreativerem Standard-Stil – die Community betrachtet beide Modelle als **komplementär, nicht als Ersatz**.

Beispiel für konversationelle Iteration:
> Erste Nachricht: "Create a photorealistic candid photograph of an elderly sailor standing on a small fishing boat. Weathered skin with visible wrinkles, pores. Shot like a 35mm film photograph, medium close-up at eye level, 50mm lens. Soft coastal daylight, shallow depth of field, subtle film grain."
> Folgenachricht: "Make the lighting warmer, add a slight golden hour cast. Keep everything else identical."

---

## Stable Diffusion 3.5, Ideogram, Recraft V3 und die Spezialisten

**Stable Diffusion 3.5** mit 8.1 Milliarden Parametern überrascht mit hervorragender natürlicher Sprachverarbeitung, aber einer kritischen Einschränkung: **Keyword-Weighting funktioniert nicht** – weder `(term:1.3)` noch `[[term]]` noch `BREAK` haben Effekt. Dafür bietet SD 3.5 bessere Künstler/Stil-Erkennung als Flux und vollständige Negative-Prompt-Unterstützung. Empfohlener CFG: ~4.4, Guidance: moderat.

**Ideogram 2/3** dominiert bei **Textrendering in Bildern** – Logos, Schilder, Poster mit akkuratem Multi-Line-Text in verschiedenen Typografie-Stilen. Die Magic Prompt AI-Feature verfeinert Prompts automatisch (abschaltbar für volle Kontrolle). Negativprompts nur für zahlende Nutzer verfügbar. Entscheidend: In V2.0+ nutzen verschiedene Styles **unterschiedliche zugrundeliegende Modelle**, nicht nur Keywords.

**Recraft V3** ist der einzige Generator, der **echte SVG-Vektordateien** ausgibt und **lange Texte** (ganze Absätze, nicht nur Einzelwörter) korrekt rendern kann. Rankings als #1 auf dem Hugging Face Text-to-Image Benchmark. Die Prompt-Struktur: `A <image style> of <main content>. <detailed description>. <background>. <style description>.` Der `colors`-Parameter akzeptiert HEX-Codes für Markenfarben. Über 100 kuratierte Professional Styles stehen zur Verfügung.

**Adobe Firefly 3** ist das **einzige Modell, das explizit für kommerziell unbedenkliche Nutzung** konzipiert wurde – trainiert ausschließlich auf Adobe Stock, offen lizenzierten Inhalten und Public Domain. Künstlernamen werden **nicht erkannt**. Negation im Prompt ("no X", "without X") fügt die genannten Elemente paradoxerweise **hinzu** – immer positive Formulierung verwenden.

**Hunyuan Image 3** (Tencent) mit **80 Milliarden Gesamtparametern** (MoE-Architektur, 13B aktiviert pro Token) ist das größte Open-Source-Bildgenerierungsmodell und versteht **1000+ Zeichen lange Prompts**. Besondere Stärke: zweisprachiges Textrendering (Chinesisch + Englisch) und Weltverständnis (geographisch korrekte Orientierungspunkte, wissenschaftliche Konzepte).

**Nano Banana 2** ist Googles Gemini 3.1 Flash Image Model (API: `gemini-3.1-flash-image-preview`). Das revolutionäre Feature: **Echtzeit-Web-Search-Grounding** – das Modell kann aktuelle Daten (Wetter, Landmarks, Events) nachschlagen und darauf basierend Bilder generieren. Bis zu **14 Referenzbilder** gleichzeitig, 14 Aspektverhältnisse (einschließlich Ultra-Wide 8:1), und ein "Thinking Mode" der interim "Thought Images" generiert bevor das finale Bild entsteht. Unterstützt Textrendering in 10+ Sprachen.

---

## Use-Case-spezifische Strategien mit Beispiel-Prompts

### Product Photography

Für E-Commerce-Freisteller: Flux und GPT-4o liefern die besten Ergebnisse. Der Schlüssel liegt in **spezifischen Material-Beschreibungen** ("brushed aluminum, matte plastic, frosted glass") kombiniert mit Studio-Lighting-Setup ("three-point softbox creating soft, diffused highlights with no harsh shadows"). Der Begriff "photorealistic" wirkt paradoxerweise kontraproduktiv – er lässt Produkte digitaler aussehen. Stattdessen: "Studio Lighting, Product Photography, shot on 100mm macro lens, f/5.6".

> Flux-Prompt: "Professional studio product photography, minimalist ceramic coffee mug with steam rising, positioned on polished concrete surface, 85mm lens at f/5.6, three-point softbox setup, soft diffused highlights, pure white seamless backdrop, high detail commercial quality"

Für weiße Hintergründe: "pure white background, seamless white backdrop, color code ffffff" plus bei GPT-4o den Parameter `background: "transparent"` für echte Freisteller.

### High Detail Concept Art

Midjourney V7 führt bei Fantasy und emotional aufgeladenen Szenen; Flux dominiert bei technischer Genauigkeit. Die wirksamste Technik: **Aktive Sprache** verwenden ("emerges through" statt "with mist") und Licht-Interaktion mit der Umgebung beschreiben statt nur Lichttypen aufzuzählen.

> Midjourney-Prompt: "Painterly concept frame of a cliffside citadel at dusk, warm lanterns against cool twilight, sweeping clouds, dramatic composition, matte painting, volumetric lighting, epic scale --ar 16:9 --v 7 --s 250"

### Fashion Photography

Midjourney ist der Community-Favorit für Mood und Editorial-Ästhetik; Flux liefert die bessere technische Fotorealität. Der Profi-Workflow: Midjourney für Mood-Exploration → Flux für finale Hero-Shots. Spezifische Kameramodelle fungieren als Style-Selektoren: **Hasselblad** → Fashion/Fine Art, **Canon EOS R5** → Commercial, **Leica M11** → Editorial. Film-Stocks als Mood-Controller: **Kodak Portra 400** für warme Hauttöne, **Fuji Velvia 50** für lebendige Farben.

> Flux-Prompt: "A high-end outdoor fashion editorial, model wearing textured linen, shot through circular polarizer lens, deep saturated cerulean sky, intense contrast with sharp high-noon highlights, Kodak Portra 400 film aesthetics, 35mm, crisp edges, authentic film grain, shot on Leica M11, f/2.8"

### Comic und Manga

Midjourneys **Niji-Modus** (--niji 5/6) ist purpose-built für Anime/Manga. Für westliche Comics den Standard-Modus mit Stil-Keywords verwenden. Stable Diffusion bietet das größte Ökosystem an Anime/Manga-LoRAs. Einfachste Formel für Comic-Strips: `main idea, number of panels, a comic book strip`. Für Schwarz-Weiß-Manga: "black and white, ink drawing, manga panel, screentone" hinzufügen.

> Midjourney Niji: "an illustration of a woman with white hair wearing a black t-shirt, in the style of colorful fantasy, cyberpunk manga, stained-glass aesthetic, vivid colors --ar 7:9 --s 750 --niji 5"

### Vektor-Grafiken und Flat Design

**Recraft V3 ist der einzige Generator mit echtem SVG-Output** – alle anderen produzieren Raster-Bilder im Vektor-Stil. Keywords: "flat design illustration, isometric art, minimalist icon, clean lines, solid colors, no gradients, geometric shapes". Design-Bewegungen referenzieren: "Swiss Style", "Material Design", "Corporate Memphis", "Bauhaus". Bei Recraft den Artistic Level senken für bessere Prompt-Treue.

> Recraft-Prompt: "A clean, modern vector brand illustration featuring refined geometric forms, soft rounded contours, balanced negative space, and a minimal layout. Controlled color harmonies, consistent line geometry, crisp SVG precision"

### Print on Demand (T-Shirts, Poster)

Die wichtigste Regel: "tshirt design" oder "poster art" als allererstes Keyword, gefolgt vom Motiv und zwingend "white background" für spätere Freistellung. Immer `--no text, --no words` als Negative verwenden, um KI-generierten Text zu vermeiden (Schrift später manuell in Canva/Kittl hinzufügen). Leonardo.Ai bietet als einzige Plattform einen nativen Transparency-Modus für direkte PNG-Exporte mit transparentem Hintergrund. Alle Outputs müssen für Print mit AI-Upscalern auf **300 DPI** hochskaliert werden.

> Midjourney: "Pterodactyl flying in outer space, tshirt design, vector artwork, vivid colors, smooth, white background --niji 5 --no text --no words"

### Realistische Portraits

Der **#1-Tipp** für fotorealistische Portraits: `--style raw` in Midjourney verwenden – entfernt die ästhetische Verschönerung und produziert kameraartige Ergebnisse. Menschliche Imperfektionen einbauen: "freckles, pores, wrinkles, subtle skin texture" erhöht den Realismus drastisch. Hände beschäftigen: "holding a phone", "resting on table" verhindert Deformationen. V7 zeigt den größten Sprung in anatomischer Korrektheit aller Midjourney-Versionen.

> Midjourney V7: "Candid portrait of an elderly man with deep wrinkles and kind eyes, wearing a weathered wool sweater, sitting in a dimly lit library. Soft ambient light, shot on Sony A7R IV, 85mm f/1.8 lens, sharp focus on eyes --ar 4:5 --style raw --v 7"

### Landschaften und Environments

Die Technik der **Tiefenschichtung** produziert die überzeugendsten Ergebnisse: Vordergrund (Wildblumen, Felsen, Pfad) → Mittelgrund (Berge, Wald, Gebäude) → Hintergrund (Himmel, ferne Gipfel) → Atmosphäre (Nebel, Regen, goldenes Licht) → Tageszeit (Golden Hour, Blue Hour, Mitternacht). Die Tageszeit bestimmt die gesamte Farbpalette.

> Flux: "Mountain landscape with dense pine forest, autumn colors on lower slopes, snow-capped peaks in background, morning mist rising from trees, golden hour lighting, warm tones, Pacific Northwest aesthetic, panoramic vista, layered depth, shot on Hasselblad X2D with XCD 90V lens at f/4"

### Infografiken und Corporate Design

DALL-E 3/GPT-4o dominiert bei Infografiken dank überlegener Textrendering-Fähigkeit – aber **KI-generierten Text immer manuell korrigieren**, da Schreibfehler fast garantiert sind. Workflow: ChatGPT eine visuelle Beschreibung generieren lassen → DALL-E das Bild erzeugen → Text in Canva/Figma ersetzen. Für Präsentations-Slides: immer "16:9", "clean layout, minimalist, professional, corporate" spezifizieren und den Verwendungszweck benennen ("for a pitch deck", "for a SaaS website hero section").

---

## Style-Konsistenz erfordert die Ein-Variable-Regel

Die goldene Regel für konsistente Bildserien: **Nur EINE Variable pro Generation ändern.** Wer Prompt, Seed, Ratio und Lighting gleichzeitig ändert, verliert jede Konsistenz. Der professionelle Workflow:

1. Base-Prompt mit Character-Bio, Lens/Ratio, Lighting, Palette, Background schreiben
2. 4–8 Optionen generieren, die beste auswählen, Seed und Settings extrahieren → das wird "der Master"
3. Den Master-Prompt duplizieren, pro Zeile NUR eine Variable ändern (Pose, Prop oder Location)
4. **Seed fixieren** wenn möglich; wenn Seed gewechselt werden muss, nichts anderes ändern
5. Finales Color-Grading in Lightroom/Photoshop mit einem synchronisierten Preset

**Midjourney --sref** (Style Reference) ist das mächtigste native Tool für stilistische Konsistenz: eine Referenz-URL oder ein numerischer Style-Code wird angefügt, und `--sw` (0–1000) steuert die Stärke. Pro-Tipp: Beim Einsatz von --sref den Text-Prompt auf Inhalte fokussieren (was man sehen will), nicht auf Stil-Worte, die mit der Referenz in Konflikt geraten könnten.

Für **Flux** ist LoRA-Training der effektivste Weg: 20–30 stilrepräsentative Bilder bei 3000 Trainingsschritten mit network_dim 32–50 erzeugen konsistente Style-LoRAs. Alternative: der **Flux IP-Adapter** und **RF Inversion** (Semantic Style Transfer ohne ControlNet) über ComfyUI.

Für **GPT-4o**: Stil explizit im ersten Prompt definieren ("in a minimalist flat vector art style with pastel colors") und diese EXAKTE Formulierung in jedem Folgeprompt wörtlich wiederholen. Selbst subtile Umformulierungen ("flat style" → "simple art style") brechen die Konsistenz.

---

## Character-Konsistenz: PuLID, LoRA und DNA-Templates

Charakter-Konsistenz – dieselbe Person über verschiedene Posen, Szenen und Ausdrücke identisch halten – bleibt die anspruchsvollste Disziplin. Die Attribut-Hierarchie: **Primäre Identifikatoren** (Gesichtsform, Haarfarbe/-stil, markante Merkmale) niemals ändern; sekundäre (Kleidungsstil, Accessoires) vorsichtig; tertiäre (Hintergrund, Beleuchtung) frei.

**Midjourney V7 --oref** (Omni Reference, Nachfolger von --cref) mit **--ow 200–400** ist der Sweet Spot für Character-Konsistenz. Zum Outfit-Wechsel: ein Referenzbild verwenden, das NUR das Gesicht zeigt. Zum Frisur-Wechsel: die Referenz auf den minimalen Augenbereich fokussieren. Die Kosten: 2x GPU-Zeit im Vergleich zu regulären V7-Generierungen.

**Flux + PuLID II** (Pure Latent Identity) ist der Community-Goldstandard für Gesichtskonsistenz. PuLID nutzt InsightFace AntelopeV2 (512-dim Face Embedding) + EVA02-CLIP (768-dim Visual Features) und injiziert Identity-Tokens in die Double-Blocks des Transformers. Anders als IP-Adapter zielt PuLID **spezifisch auf Identitätsmerkmale** und löst das "Model Pollution"-Problem (Stil-Degradation durch Character-Injection). Setup über ComfyUI mit dem Modell `pulid_flux_v0.9.1.safetensors`.

**GPT-4o nutzt das "DNA Template"-Verfahren**: Zu Beginn einer Session eine vollständige Charakter-Beschreibung erstellen mit physischen Attributen (Gesichtsform, Augenfarbe als HEX-Code, Haar, Build, Distinguishing Marks), Kleidung (jedes einzelne Kleidungsstück explizit mit Farbe und Stil) und optional "LOCKED"-Parametern. Dann innerhalb desselben Conversation-Threads iterieren: "Show the same exact character, but now in a café." Niemals einen neuen Chat starten – die Konversationshistorie ist der Konsistenz-Anker.

**Stable Diffusion LoRA-Training** bleibt der Gold-Standard für dauerhafte Character-Konsistenz: 15–20 hochqualitative Bilder aus verschiedenen Winkeln und Lichtsituationen, Training über Kohya_ss mit network_dim 16–32 bei 2000 Steps, ergibt eine .safetensors-Datei (10–200MB) die über einen Trigger-Word in jedem Prompt aktiviert wird. Für maximale Kontrolle: ControlNet OpenPose (Pose) + IP-Adapter (Identität) + ADetailer (Gesichtskorrektur) + Inpainting (gezielte Fixes) kombinieren.

Die "Name Anchoring"-Technik für Einsteiger: Zwei Celebrity-Namen kombinieren ("Photo of Eldara Vane, a mix of Emma Watson and Zoe Saldana") erzeugt ein neues, reproduzierbares Gesicht, solange die exakte Namenskombination in jedem Prompt beibehalten wird.

---

## Den Midjourney-Look in anderen Modellen reproduzieren

Der "Midjourney-Look" entsteht aus **opinionierter künstlerischer Interpretation**: cineastische Beleuchtung, reiche Farbharmonie, malerische Qualität, atmosphärische Tiefe, emotionaler Mood und Enhanced Micro-Detail – Qualitäten, die MJ standardmäßig hinzufügt, andere Modelle aber nicht. Der Kern: MJ interpretiert Prompts künstlerisch, Flux reproduziert sie getreu.

**Für Flux** existieren dedizierte LoRAs: "Flux-Midjourney-Mix-LoRA" (Trigger: "midjourney mix", trainiert auf 60+ MJ-Style-Bildern) und "Flux-Midjourney-Mix2-LoRA" (Trigger: "MJ v6"). Ohne LoRA muss man die ästhetischen Qualitäten, die MJ automatisch liefert, **explizit anfordern**: "cinematic lighting, dramatic shadows, volumetric light, rich color palette, color harmony, warm tones, atmospheric perspective, depth of field, bokeh, painterly quality, film grain". Flux braucht mehr physikalische Licht- und Material-Beschreibungen als MJ.

**Für Stable Diffusion**: Die AlbedobaseXL-Checkpoint ist am nächsten an der MJ-Ästhetik. LoRA-Kombination empfohlen: xl_more_art (hohe Gewichtung, stabil) + Midjourney Mimic (niedrige Gewichtung 0.3–0.5, sehr starker Effekt) + Detail Tweaker. Quality-Modifier ("masterpiece, best quality, 8K") funktionieren in SD noch, plus starke Negative Prompts.

**Für DALL-E/GPT-4o**: Art-Direction-Sprache verwenden, Konzeptkunst und Filmproduktionsdesign referenzieren: "In the style of concept art for a major film production, romantic lighting, volumetric god rays, rich saturated color palette with deep shadows and warm highlights, painterly atmospheric depth."

Der Community-Konsens: **Kein einzelnes Modell repliziert MJs Ästhetik vollständig ohne erheblichen Aufwand.** Der MJ-Look entsteht aus dem opinionierten Training des Modells. Der schnellste Weg in anderen Modellen führt über dedizierte LoRAs (Flux/SD) oder extrem detaillierte Art-Direction-Prompts.

---

## Negative Prompts: Ein Modell-spezifisches Werkzeug

Die Effektivität und Verfügbarkeit von Negative Prompts variiert drastisch zwischen Modellen. **Stable Diffusion** (alle Versionen) bietet volle Unterstützung mit separatem Textfeld – hier sind Negative Prompts essentiell und dramatisch wirkungsvoll. Technisch funktionieren sie über zwei Forward-Passes pro Step: der konditionierte Pass mit dem Positiv-Prompt und der unkonditionierte mit dem Negativ-Prompt, wobei der CFG-Scale die Differenz verstärkt.

Die effektivsten universellen Negativ-Keywords für SD: `(worst quality:2), (low quality:2), blurry, watermark, text, bad anatomy, deformed, extra fingers, mutated hands, poorly drawn face`. Die Embeddings `EasyNegative` und `badhandv4` kapseln hunderte dieser Keywords in einzelne Token. **Midjourney** bietet `--no` (äquivalent zu Gewicht -0.5) und feinere Steuerung über negative Multi-Prompt-Gewichte (`element::-0.5`).

**Flux Pro/Max, DALL-E 3/GPT-4o und Nano Banana 2 unterstützen keine nativen Negative Prompts.** Die universelle Lösung: positive Umformulierung. Statt "no blur" → "sharp focus throughout"; statt "no people" → "empty scene, desolate"; statt "not cartoon" → "photorealistic, photographed". Für Flux existiert ein Community-Workaround über Dynamic Thresholding in ComfyUI, aber die Ergebnisse sind inkonsistent.

**Adobe Firefly** hat eine turbulente Geschichte mit Negativ-Prompts – die Funktion erschien und verschwand über Updates hinweg. Aktuell existiert eine "Exclude from image"-Option, aber Negation im Prompt-Text ("no X") fügt die genannten Elemente paradoxerweise hinzu. Die Hack-Syntax `[avoid=green, cars]` funktioniert möglicherweise.

---

## Technische Parameter: CFG, Sampler und Aspect Ratios

Die **CFG-Scale** (Classifier-Free Guidance) variiert fundamental zwischen Modellen: SD 1.5 arbeitet am besten bei **CFG 7**, SDXL bei **5–7**, und Flux benötigt den drastisch niedrigeren Wert von **1–4** (Sweet Spot ~3.5) – CFG 7+ erzeugt bei Flux übersättigte, artifizielle Ergebnisse. Turbo/Lightning-Modelle deaktivieren CFG komplett (Wert 1). Eine Schlüssel-Interaktion: höhere CFG + mehr Steps = bessere Prompt-Treue aber Artefakt-Risiko; bei ControlNet-Einsatz CFG um 1–2 Punkte reduzieren.

Für **Sampling Steps** gilt: 20 Steps erreichen ~95% der Qualität von 50 Steps bei den meisten Samplern. Der empfohlene Startpunkt: **DPM++ 2M Karras bei 20 Steps** – der beste Allround-Sampler mit optimaler Balance zwischen Qualität und Geschwindigkeit. Euler a (nicht-konvergent) eignet sich für kreative Exploration mit mehr Variation; DPM++ SDE Karras für besonders realistische Bilder; LCM für Echtzeit-Rendering bei 4–8 Steps.

**Aspect Ratios** folgen dem Verwendungszweck: 1:1 für Social Media und Produktfotos; 16:9 für Landschaften, Cinematics und Präsentationen; 9:16 für Mobile Content und Stories; 4:5 für Instagram-Feed und Portraits; 3:2 für klassische Fotografie-Prints; 21:9 für Ultra-Wide Cinematics. SD 1.5 muss nahe ~262.144 Gesamtpixeln bleiben (sonst doppelte Köpfe); SDXL bei ~1 Megapixel; SD 3.5 handhabt nicht-standardmäßige Ratios ohne Duplikationsprobleme.

---

## Fortgeschrittene Techniken von LoRA bis Regional Prompting

**Prompt Weighting** in Stable Diffusion: `(keyword:1.5)` setzt explizites Gewicht (nutzbarer Bereich 0.5–1.5, darüber Bild-Bruch-Risiko). Das **BREAK-Keyword** füllt den aktuellen 75-Token-Chunk mit Padding und startet einen neuen – essentiell um Farb/Attribut-Bleeding zwischen Prompt-Sektionen zu verhindern: `1girl, red hat BREAK blue dress`. Das **AND-Keyword** (`cat AND dog`) generiert beide Konzepte simultan, erfordert aber reduzierte CFG (~5). **Prompt Scheduling** (`[from:to:0.4]`) wechselt bei 40% der Steps von einem Konzept zum anderen – nützlich für Gesichtsmischungen und Stil-Morphing.

**LoRA-Stacking** folgt klaren Regeln: Startgewicht 0.7, bei Kombination mehrerer LoRAs jede auf 0.5–0.7 reduzieren um Übersteuerung zu vermeiden. Reihenfolge: ControlNet zuerst (strukturelle Basis) → LoRAs danach (stilistische Verfeinerung). SD 1.5 LoRAs funktionieren **nicht** auf SDXL und umgekehrt.

**ControlNet** bietet zehn+ Kontrolltypen: **Canny** (Kantenmap, ~94% strukturelle Treue) für Kompositionserhalt bei Stilwechsel; **OpenPose** (Skelett-Keypoints, ~89% Pose-Treue) für konsistente Körperhaltungen; **Depth** (Tiefenkarte, ~92% räumlich) für 3D-Beziehungen; **Scribble** für Sketch-zu-Bild-Konvertierung. Multi-ControlNet-Kombinationen: Canny + Depth für Architekturvisualisierung; OpenPose + Depth für Character-Animation. Gesamtstärke bei Kombination: ~0.8–1.0 (z.B. 0.5 Pose + 0.4 Depth).

**Regional Prompting** weist verschiedenen Bildbereichen unterschiedliche Prompts zu: In A1111 via Regional Prompter Extension mit Ratio-Definitionen (`1,1,1` für drei gleiche Spalten) und BREAK-Separation. In ComfyUI über Mask-basierte Conditioning-Nodes. **Inpainting** bei Denoising Strength 0.3–0.6 für subtile Änderungen, 0.6–0.9 für dramatische Ersetzungen. **Upscaling** immer stufenweise (2x → 2x statt direkt 4x); R-ESRGAN 4x+ als bester Allround-Upscaler für fotorealistische Bilder.

---

## Modell-Auswahl: Wann welches Modell das richtige ist

| Kriterium | Empfohlenes Modell |
|---|---|
| Maximale Prompt-Treue | Flux 2 Pro/Max |
| Künstlerische Interpretation/Mood | Midjourney V7 |
| Textrendering (Logos, Signs, UI) | Ideogram 2/3 oder GPT-4o |
| Echte SVG-Vektorausgabe | Recraft V3 (einzige Option) |
| Kommerzielle Sicherheit/Provenienz | Adobe Firefly 3 |
| Open-Source-Flexibilität/Fine-Tuning | Stable Diffusion 3.5 oder Hunyuan Image 3 |
| Konversationelle Iteration | GPT-4o / gpt-image-1.5 |
| Echtzeit-Webdaten im Bild | Nano Banana 2 (einzigartig) |
| Bilingualer Content (CN+EN) | Hunyuan Image 3 |
| Character-Konsistenz (14 Referenzen) | Nano Banana 2 |
| Anime/Manga | Midjourney Niji oder SD mit Anime-LoRAs |
| Produkt-Fotografie mit Freisteller | Flux 2 oder GPT-4o (`background: transparent`) |

---

## Die fünf zentralen Paradigmenwechsel als Fazit

Erstens: **Natürliche Sprache hat Keywords bei allen modernen Modellen abgelöst** – nur SD 1.5/SDXL profitiert noch von Komma-getrennter Tag-Syntax. Zweitens: **Kamera-Spezifikationen sind die neuen Quality-Tags** – "Shot on Sony A7IV, 85mm f/1.4" ist der universellste Qualitätsbooster über alle Modelle hinweg, weil er tausende professionelle Trainingsbilder aktiviert. Drittens: **Character-Konsistenz ist gelöst**, aber nur durch modellspezifische Werkzeuge (--oref, PuLID, LoRA-Training, DNA-Templates) statt durch Prompt-Magie allein. Viertens: **Die Modelllandschaft ist komplementär geworden** – der Profi-Workflow kombiniert Midjourney für Mood-Exploration, Flux für technische Präzision, GPT-4o für Text-Integration und Recraft für Vektorgrafiken. Fünftens: **Iteratives Arbeiten schlägt den perfekten Einzelprompt** – kurz starten, die beste Variante auswählen, gezielt verfeinern. Die Community hat das mit 3.400 Upvotes auf r/midjourney bestätigt, und es gilt für jedes einzelne Modell.