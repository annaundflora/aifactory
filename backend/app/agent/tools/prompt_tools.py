"""LangGraph tools for prompt drafting and refinement.

Provides draft_prompt and refine_prompt tools that the agent uses to create
and iteratively improve structured image generation prompts. Each tool returns
a dict with motiv, style, and negative_prompt fields (all in English).

The LLM agent is responsible for the creative prompt engineering. These tools
serve as structured output wrappers that validate input, return the structured
dict, and trigger the post_process_node to update the graph state.
"""

from langchain_core.tools import tool


@tool
def draft_prompt(collected_info: dict) -> dict:
    """Create a structured image generation prompt from collected information.

    Takes the information gathered during conversation (subject, style, purpose, mood, etc.)
    and produces a structured prompt with three fields: motiv, style, and negative_prompt.
    All prompt text must be in English regardless of the conversation language.

    The collected_info dict must contain at least a 'subject' key. It should also contain
    'style' and 'negative_prompt' if available. Additional keys like 'purpose', 'mood',
    'lighting', 'composition', 'color_palette' are used to enrich the prompt.

    Args:
        collected_info: Dict with gathered information. Required: 'subject'.
            Optional: 'style', 'purpose', 'mood', 'lighting', 'composition',
            'negative_prompt', 'color_palette', 'quality_markers', etc.

    Returns:
        Dict with keys 'motiv' (str), 'style' (str), 'negative_prompt' (str).

    Raises:
        ValueError: If 'subject' is missing or empty in collected_info.
    """
    if not collected_info or not collected_info.get("subject"):
        raise ValueError(
            "collected_info must contain a non-empty 'subject' key. "
            "Please gather at least the subject/motif from the user before drafting."
        )

    subject = collected_info["subject"]
    style_direction = collected_info.get("style", "photorealistic")
    purpose = collected_info.get("purpose", "general")
    mood = collected_info.get("mood", "")
    lighting = collected_info.get("lighting", "")
    composition = collected_info.get("composition", "")
    color_palette = collected_info.get("color_palette", "")
    negative = collected_info.get("negative_prompt", "")

    # If the agent already provides fully formed fields, use them directly
    if collected_info.get("motiv") and collected_info.get("negative_prompt"):
        return {
            "motiv": str(collected_info["motiv"]),
            "style": str(collected_info.get("style", style_direction)),
            "negative_prompt": str(collected_info["negative_prompt"]),
        }

    # Build the motiv field from components
    motiv_parts = [subject]
    if composition:
        motiv_parts.append(composition)
    if mood:
        motiv_parts.append(f"{mood} atmosphere")
    if lighting:
        motiv_parts.append(f"{lighting} lighting")
    motiv = ", ".join(part for part in motiv_parts if part)

    # Build the style field with quality markers
    style_parts = [style_direction]
    if color_palette:
        style_parts.append(f"{color_palette} color palette")

    purpose_quality = {
        "social media": "vibrant colors, eye-catching",
        "web": "clean, professional, high resolution",
        "print": "ultra high resolution, print quality, sharp details",
        "art": "artistic, gallery quality, masterpiece",
        "general": "highly detailed, professional quality",
    }
    quality = purpose_quality.get(purpose.lower(), purpose_quality["general"])
    style_parts.append(quality)
    style_text = ", ".join(part for part in style_parts if part)

    # Build negative prompt with sensible defaults
    if negative:
        negative_prompt = negative
    else:
        default_negatives = [
            "blurry",
            "low quality",
            "low resolution",
            "deformed",
            "distorted",
            "disfigured",
            "bad anatomy",
            "watermark",
            "text",
            "signature",
        ]
        negative_prompt = ", ".join(default_negatives)

    return {
        "motiv": motiv,
        "style": style_text,
        "negative_prompt": negative_prompt,
    }


@tool
def refine_prompt(current_draft: dict, feedback: str) -> dict:
    """Refine an existing structured prompt based on user feedback.

    Takes the current prompt draft and user feedback, then produces an updated
    version incorporating the requested changes. The agent (LLM) should modify
    the fields based on the feedback and pass the updated values. At least one
    field should differ from the original draft.

    All prompt text must be in English regardless of the conversation language.

    Args:
        current_draft: Dict with current prompt fields. Expected keys:
            'motiv' (str), 'style' (str), 'negative_prompt' (str).
        feedback: User feedback describing desired changes (e.g., "add dramatic lighting",
            "make it more vibrant", "remove the watermark mention").

    Returns:
        Dict with updated keys 'motiv' (str), 'style' (str), 'negative_prompt' (str).
    """
    motiv = current_draft.get("motiv", "")
    style = current_draft.get("style", "")
    negative_prompt = current_draft.get("negative_prompt", "")

    # If the agent provides fully updated fields in current_draft, use them.
    # The agent is expected to do the creative refinement and pass the result
    # through this tool for state update. The feedback string documents what
    # was changed for traceability.

    # Ensure all three fields are non-empty strings
    if not motiv:
        motiv = feedback
    if not style:
        style = "highly detailed, professional quality"
    if not negative_prompt:
        negative_prompt = "blurry, low quality, deformed"

    return {
        "motiv": str(motiv),
        "style": str(style),
        "negative_prompt": str(negative_prompt),
    }
