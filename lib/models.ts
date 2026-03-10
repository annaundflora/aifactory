export interface Model {
  id: string;
  displayName: string;
  pricePerImage: number;
}

export const MODELS: Model[] = [
  // --- Premium ---
  {
    id: "black-forest-labs/flux-2-pro",
    displayName: "FLUX 2 Pro",
    pricePerImage: 0.055,
  },
  {
    id: "openai/gpt-image-1.5",
    displayName: "GPT Image 1.5",
    pricePerImage: 0.03,
  },
  {
    id: "google/nano-banana-pro",
    displayName: "Nano Banana Pro",
    pricePerImage: 0.04,
  },
  {
    id: "recraft-ai/recraft-v4",
    displayName: "Recraft V4",
    pricePerImage: 0.04,
  },
  // --- Mid-Tier ---
  {
    id: "bytedance/seedream-5-lite",
    displayName: "Seedream 5 Lite",
    pricePerImage: 0.035,
  },
  {
    id: "bytedance/seedream-4.5",
    displayName: "Seedream 4.5",
    pricePerImage: 0.06,
  },
  {
    id: "google/imagen-4-fast",
    displayName: "Imagen 4 Fast",
    pricePerImage: 0.04,
  },
  {
    id: "google/gemini-2.5-flash-image",
    displayName: "Gemini 2.5 Flash",
    pricePerImage: 0.04,
  },
  {
    id: "ideogram-ai/ideogram-v3-turbo",
    displayName: "Ideogram V3 Turbo",
    pricePerImage: 0.03,
  },
];

export function getModelById(id: string): Model | undefined {
  return MODELS.find((model) => model.id === id);
}

export const UPSCALE_MODEL: string = "nightmareai/real-esrgan";
