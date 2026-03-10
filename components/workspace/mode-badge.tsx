"use client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Mode = "txt2img" | "img2img" | "upscale";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ModeBadgeProps {
  mode: Mode;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MODE_LABEL: Record<Mode, string> = {
  txt2img: "T",
  img2img: "I",
  upscale: "U",
};

const MODE_TITLE: Record<Mode, string> = {
  txt2img: "Text to Image",
  img2img: "Image to Image",
  upscale: "Upscale",
};

// ---------------------------------------------------------------------------
// ModeBadge
// ---------------------------------------------------------------------------

export function ModeBadge({ mode }: ModeBadgeProps) {
  return (
    <span
      title={MODE_TITLE[mode]}
      className="absolute top-2 left-2 flex size-5 items-center justify-center rounded-full bg-black/60 text-[10px] font-bold text-white select-none"
    >
      {MODE_LABEL[mode]}
    </span>
  );
}
