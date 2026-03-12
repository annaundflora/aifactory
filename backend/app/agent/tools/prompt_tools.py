"""LangGraph tools for prompt drafting and refinement.

Provides draft_prompt and refine_prompt tools that the agent uses to create
and iteratively improve structured image generation prompts. Each tool returns
a dict with motiv, style, and negative_prompt fields (all in English).
"""

from langchain_core.tools import tool


@tool
def draft_prompt(collected_info: dict) -> dict:
    """Create a structured image generation prompt from collected information.

    Takes the information gathered during conversation (subject, style, purpose, mood, etc.)
    and produces a structured prompt with three fields: motiv, style, and negative_prompt.
    All prompt text must be in English regardless of the conversation language.

    The collected_info dict must contain at least a 'subject' key. Optional keys include
    'style', 'purpose', 'mood', 'lighting', 'composition', 'color_palette', and any
    other descriptive attributes gathered from the user.

    Args:
        collected_info: Dict with gathered information. Required: 'subject'.
            Optional: 'style', 'purpose', 'mood', 'lighting', 'composition', etc.

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
    style = collected_info.get("style", "photorealistic")
    purpose = collected_info.get("purpose", "general")
    mood = collected_info.get("mood", "")
    lighting = collected_info.get("lighting", "")
    composition = collected_info.get("composition", "")
    color_palette = collected_info.get("color_palette", "")

    # Build the motiv field: subject with compositional and mood details
    motiv_parts = [subject]
    if composition:
        motiv_parts.append(composition)
    if mood:
        motiv_parts.append(f"{mood} atmosphere")
    if lighting:
        motiv_parts.append(f"{lighting} lighting")
    motiv = ", ".join(motiv_parts)

    # Build the style field: style direction with quality markers
    style_parts = [style]
    if color_palette:
        style_parts.append(f"{color_palette} color palette")

    # Add purpose-aware quality markers
    purpose_markers = {
        "social media": "vibrant colors, eye-catching, trending on social media",
        "web": "clean, professional, high resolution",
        "print": "ultra high resolution, print quality, sharp details",
        "art": "artistic, gallery quality, masterpiece",
        "general": "highly detailed, professional quality",
    }
    quality = purpose_markers.get(purpose.lower(), purpose_markers["general"])
    style_parts.append(quality)

    style_text = ", ".join(style_parts)

    # Build negative prompt: standard quality filters plus context-specific exclusions
    negative_parts = [
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

    # Add context-specific negatives based on subject/style
    if "person" in subject.lower() or "portrait" in subject.lower() or "face" in subject.lower():
        negative_parts.extend(["extra fingers", "extra limbs", "ugly", "mutation"])
    if "landscape" in subject.lower() or "nature" in subject.lower():
        negative_parts.extend(["artifacts", "oversaturated"])
    if style.lower() in ("photorealistic", "photograph", "photo"):
        negative_parts.extend(["illustration", "cartoon", "painting", "drawing"])

    negative_prompt = ", ".join(negative_parts)

    return {
        "motiv": motiv,
        "style": style_text,
        "negative_prompt": negative_prompt,
    }


@tool
def refine_prompt(current_draft: dict, feedback: str) -> dict:
    """Refine an existing structured prompt based on user feedback.

    Takes the current prompt draft and user feedback, then produces an updated
    version incorporating the requested changes. At least one field should
    differ from the original draft. All prompt text must be in English.

    Args:
        current_draft: Dict with current prompt fields:
            'motiv' (str), 'style' (str), 'negative_prompt' (str).
        feedback: User feedback describing desired changes (e.g., "add dramatic lighting",
            "make it more vibrant", "remove the watermark mention").

    Returns:
        Dict with updated keys 'motiv' (str), 'style' (str), 'negative_prompt' (str).
    """
    motiv = current_draft.get("motiv", "")
    style = current_draft.get("style", "")
    negative_prompt = current_draft.get("negative_prompt", "")

    feedback_lower = feedback.lower()

    # Apply feedback heuristics to modify the appropriate fields
    # The LLM agent will typically call this tool with specific instructions,
    # so these heuristics serve as a reasonable baseline when the agent
    # delegates the refinement to the tool.

    # Check for lighting-related feedback
    lighting_keywords = ["lighting", "light", "shadow", "bright", "dark", "dramatic", "soft light", "backlight"]
    if any(kw in feedback_lower for kw in lighting_keywords):
        # Add lighting info to motiv
        motiv = f"{motiv}, {feedback}"

    # Check for style-related feedback
    style_keywords = ["style", "vibrant", "muted", "color", "palette", "warm", "cool", "tone", "aesthetic"]
    elif_style = any(kw in feedback_lower for kw in style_keywords)

    # Check for negative prompt feedback
    negative_keywords = ["remove", "no ", "without", "avoid", "exclude", "negative"]
    elif_negative = any(kw in feedback_lower for kw in negative_keywords)

    # Check for composition/framing feedback
    composition_keywords = ["composition", "frame", "angle", "perspective", "close-up", "wide", "zoom"]
    elif_composition = any(kw in feedback_lower for kw in composition_keywords)

    if elif_style:
        style = f"{style}, {feedback}"
    elif elif_negative:
        negative_prompt = f"{negative_prompt}, {feedback}"
    elif elif_composition:
        motiv = f"{motiv}, {feedback}"
    else:
        # Default: apply feedback to motiv as it's the most general field
        motiv = f"{motiv}, {feedback}"

    return {
        "motiv": motiv,
        "style": style,
        "negative_prompt": negative_prompt,
    }
