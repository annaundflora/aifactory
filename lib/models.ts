export interface Model {
  id: string;
  displayName: string;
  pricePerImage: number;
}

export const MODELS: Model[] = [
  {
    id: "black-forest-labs/flux-2-pro",
    displayName: "FLUX 2 Pro",
    pricePerImage: 0.055,
  },
  {
    id: "google/nano-banana-2",
    displayName: "Nano Banana 2",
    pricePerImage: 0,
  },
  {
    id: "recraft-ai/recraft-v4",
    displayName: "Recraft V4",
    pricePerImage: 0,
  },
  {
    id: "bytedance/seedream-5-lite",
    displayName: "Seedream 5 Lite",
    pricePerImage: 0,
  },
  {
    id: "bytedance/seedream-4.5",
    displayName: "Seedream 4.5",
    pricePerImage: 0,
  },
  {
    id: "google/gemini-2.5-flash-image",
    displayName: "Gemini 2.5 Flash Image",
    pricePerImage: 0,
  },
];

export function getModelById(id: string): Model | undefined {
  return MODELS.find((model) => model.id === id);
}
