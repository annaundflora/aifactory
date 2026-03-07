export type PromptTemplate = {
  id: string
  label: string
  motiv: string
  style: string
  negativePrompt: string
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: "product-shot",
    label: "Product Shot",
    motiv: "[Your product] on a clean surface",
    style:
      "professional product photography, studio lighting, white background, sharp focus, commercial quality",
    negativePrompt: "blurry, dark, cluttered background, low quality",
  },
  {
    id: "landscape",
    label: "Landscape",
    motiv: "[Describe the landscape]",
    style:
      "breathtaking landscape photography, golden hour, dramatic sky, high dynamic range, ultra sharp",
    negativePrompt: "people, buildings, text, watermark",
  },
  {
    id: "character-design",
    label: "Character Design",
    motiv: "[Describe your character]",
    style:
      "detailed character design, full body, concept art style, clean lines, professional illustration",
    negativePrompt: "blurry, deformed, extra limbs, bad anatomy",
  },
  {
    id: "logo-design",
    label: "Logo Design",
    motiv: "[Your brand/concept]",
    style:
      "minimalist logo design, clean vector style, professional branding, simple shapes, scalable",
    negativePrompt: "photorealistic, complex, 3D, gradients, text",
  },
  {
    id: "abstract-art",
    label: "Abstract Art",
    motiv: "[Your abstract concept]",
    style:
      "abstract expressionist artwork, bold colors, dynamic composition, textured brushstrokes, gallery quality",
    negativePrompt: "realistic, photographic, text, faces",
  },
]
