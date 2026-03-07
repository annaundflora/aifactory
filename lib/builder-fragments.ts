export type BuilderFragment = {
  id: string
  label: string
  fragment: string
}

export type BuilderCategory = {
  id: string
  label: string
  fragments: BuilderFragment[]
}

export const BUILDER_CATEGORIES: BuilderCategory[] = [
  {
    id: "style",
    label: "Style",
    fragments: [
      {
        id: "style-oil-painting",
        label: "Oil Painting",
        fragment:
          "rendered as a classical oil painting with visible brushstrokes, rich impasto texture, and dramatic chiaroscuro lighting",
      },
      {
        id: "style-watercolor",
        label: "Watercolor",
        fragment:
          "painted in delicate watercolor with soft wet-on-wet washes, translucent layers, and fluid color bleeding at the edges",
      },
      {
        id: "style-pencil-sketch",
        label: "Pencil Sketch",
        fragment:
          "drawn as a detailed pencil sketch with fine hatching, cross-hatching, and subtle shading on textured paper",
      },
      {
        id: "style-digital-concept",
        label: "Digital Concept Art",
        fragment:
          "rendered as polished digital concept art with painterly brushwork, rich color gradients, and cinematic composition",
      },
      {
        id: "style-photorealistic",
        label: "Photorealistic",
        fragment:
          "captured in photorealistic style with ultra-sharp detail, accurate depth of field, and true-to-life surface textures",
      },
      {
        id: "style-anime",
        label: "Anime",
        fragment:
          "drawn in a detailed anime illustration style with clean linework, cel shading, and vibrant saturated colors",
      },
      {
        id: "style-impressionist",
        label: "Impressionist",
        fragment:
          "painted in an impressionist manner with loose visible brushstrokes, dappled light effects, and spontaneous color dabs",
      },
      {
        id: "style-art-nouveau",
        label: "Art Nouveau",
        fragment:
          "designed in Art Nouveau style with flowing organic lines, intricate floral ornaments, and decorative sinuous curves",
      },
      {
        id: "style-cinematic",
        label: "Cinematic",
        fragment:
          "presented in a cinematic widescreen aesthetic with anamorphic lens flares, film grain, and a 2.39:1 aspect ratio feel",
      },
    ],
  },
  {
    id: "colors",
    label: "Colors",
    fragments: [
      {
        id: "colors-warm-golden",
        label: "Warm Golden",
        fragment:
          "warm color palette dominated by golden ambers, burnt sienna, and deep crimson tones that evoke late afternoon warmth",
      },
      {
        id: "colors-cool-blue",
        label: "Cool Blue",
        fragment:
          "cool color palette of icy cerulean blues, deep navy shadows, and crisp silver highlights conveying calm and clarity",
      },
      {
        id: "colors-earth-tones",
        label: "Earth Tones",
        fragment:
          "muted earth tone palette of raw umber, terracotta, sage green, and warm ivory whites for a grounded natural feel",
      },
      {
        id: "colors-neon-vivid",
        label: "Neon Vivid",
        fragment:
          "electric neon color scheme with hot pink, acid yellow, and cyan blue highlights popping against deep black backgrounds",
      },
      {
        id: "colors-monochromatic",
        label: "Monochromatic",
        fragment:
          "monochromatic color treatment using a single hue in varying saturations and tints from near-white to deep shadow",
      },
      {
        id: "colors-pastel-soft",
        label: "Pastel Soft",
        fragment:
          "soft pastel palette of blush rose, powder blue, mint green, and lavender creating an airy dreamy atmosphere",
      },
      {
        id: "colors-dark-moody",
        label: "Dark Moody",
        fragment:
          "dark moody palette of charcoal grays, forest greens, and deep burgundy with subdued saturation and heavy shadows",
      },
      {
        id: "colors-complementary",
        label: "Complementary",
        fragment:
          "bold complementary color contrast pairing deep violet shadows with warm amber highlights for maximum visual tension",
      },
      {
        id: "colors-duotone",
        label: "Duotone",
        fragment:
          "stylized duotone treatment using two bold contrasting colors replacing all shadow and highlight tones throughout the image",
      },
    ],
  },
  {
    id: "composition",
    label: "Composition",
    fragments: [
      {
        id: "comp-low-angle",
        label: "Low Angle",
        fragment:
          "shot from a low angle perspective with dramatic foreshortening, subject towering above the viewer against an open sky",
      },
      {
        id: "comp-bird-eye",
        label: "Bird's Eye",
        fragment:
          "viewed from a top-down bird's eye perspective looking straight down, revealing patterns and shapes invisible from ground level",
      },
      {
        id: "comp-rule-of-thirds",
        label: "Rule of Thirds",
        fragment:
          "composed according to the rule of thirds with the main subject positioned at a strong intersection point off-center",
      },
      {
        id: "comp-symmetry",
        label: "Symmetry",
        fragment:
          "perfectly symmetrical bilateral composition with the subject centered and mirrored on both sides of a central axis",
      },
      {
        id: "comp-leading-lines",
        label: "Leading Lines",
        fragment:
          "strong leading lines converging toward the subject, guiding the eye through the frame with purposeful directional movement",
      },
      {
        id: "comp-extreme-closeup",
        label: "Extreme Close-Up",
        fragment:
          "captured in extreme close-up macro detail, filling the entire frame with texture and intricate surface patterns",
      },
    ],
  },
  {
    id: "lighting",
    label: "Lighting",
    fragments: [
      {
        id: "light-golden-hour",
        label: "Golden Hour",
        fragment:
          "bathed in soft golden hour sunlight with long warm shadows, glowing highlights, and a rich amber atmospheric haze",
      },
      {
        id: "light-dramatic-side",
        label: "Dramatic Side Light",
        fragment:
          "lit by a single dramatic side light source casting deep contrasting shadows and revealing intricate surface texture",
      },
      {
        id: "light-neon-night",
        label: "Neon Night",
        fragment:
          "illuminated by colorful neon signs and artificial street lights reflecting wet pavement in a dark night scene",
      },
      {
        id: "light-soft-diffused",
        label: "Soft Diffused",
        fragment:
          "softly lit with diffused overcast light that eliminates harsh shadows and renders every detail with even gentle luminosity",
      },
      {
        id: "light-rim",
        label: "Rim Light",
        fragment:
          "back-lit with a bright rim light tracing the silhouette in a glowing halo separating the subject from a dark background",
      },
      {
        id: "light-volumetric",
        label: "Volumetric",
        fragment:
          "filled with dramatic volumetric god rays breaking through gaps in clouds or foliage, with visible light shafts and dust particles",
      },
    ],
  },
  {
    id: "mood",
    label: "Mood",
    fragments: [
      {
        id: "mood-serene",
        label: "Serene",
        fragment:
          "conveying a sense of serene tranquility with soft focus, muted atmospheric haze, and peaceful stillness in every element",
      },
      {
        id: "mood-epic",
        label: "Epic",
        fragment:
          "evoking an epic grand scale with sweeping vistas, heroic proportions, and an overwhelming sense of awe-inspiring magnitude",
      },
      {
        id: "mood-melancholy",
        label: "Melancholy",
        fragment:
          "suffused with quiet melancholy through desaturated tones, solitary figures, and an atmosphere of wistful contemplative sadness",
      },
      {
        id: "mood-mysterious",
        label: "Mysterious",
        fragment:
          "wrapped in an air of mystery with obscured details, deep fog, and shadows that hint at hidden elements just beyond view",
      },
      {
        id: "mood-joyful",
        label: "Joyful",
        fragment:
          "radiating joyful energy with bright warm colors, dynamic movement, and a light vibrant atmosphere full of optimism",
      },
      {
        id: "mood-tense",
        label: "Tense",
        fragment:
          "charged with psychological tension through tight framing, harsh contrasts, and compositional imbalance that creates unease",
      },
    ],
  },
]
