"""LangGraph tools for prompt drafting and refinement.

Provides draft_prompt and refine_prompt tools that the agent uses to create
and iteratively improve image generation prompts. Each tool returns
a dict with a single ``prompt`` field (in English).

The LLM agent is responsible for the creative prompt engineering. These tools
serve as structured output wrappers that validate input, return the structured
dict, and trigger the post_process_node to update the graph state.
"""

from langchain_core.tools import tool


@tool
def draft_prompt(collected_info: dict) -> dict:
    """Create an image generation prompt from collected information.

    Takes the information gathered during conversation (subject, style, purpose, mood, etc.)
    and produces a single prompt string. All prompt text must be in English regardless of
    the conversation language.

    The collected_info dict must contain at least a 'subject' key. Additional keys like
    'style', 'purpose', 'mood', 'lighting', 'composition', 'color_palette' are used
    to enrich the prompt.

    If the agent already provides a complete prompt via the 'prompt' key in
    collected_info, that value is returned directly.

    Args:
        collected_info: Dict with gathered information. Required: 'subject'.
            Optional: 'prompt' (complete prompt), 'style', 'purpose', 'mood',
            'lighting', 'composition', 'color_palette', 'quality_markers', etc.

    Returns:
        Dict with a single key 'prompt' (str).

    Raises:
        ValueError: If 'subject' is missing or empty in collected_info.
    """
    if not collected_info or not collected_info.get("subject"):
        raise ValueError(
            "collected_info must contain a non-empty 'subject' key. "
            "Please gather at least the subject/motif from the user before drafting."
        )

    # If the agent already provides a complete prompt, use it directly
    if collected_info.get("prompt"):
        return {"prompt": str(collected_info["prompt"])}

    subject = collected_info["subject"]
    style_direction = collected_info.get("style", "photorealistic")
    purpose = collected_info.get("purpose", "general")
    mood = collected_info.get("mood", "")
    lighting = collected_info.get("lighting", "")
    composition = collected_info.get("composition", "")
    color_palette = collected_info.get("color_palette", "")

    # Build a single prompt from components
    prompt_parts = [subject]
    if composition:
        prompt_parts.append(composition)
    if mood:
        prompt_parts.append(f"{mood} atmosphere")
    if lighting:
        prompt_parts.append(f"{lighting} lighting")

    # Append style and quality markers
    prompt_parts.append(style_direction)
    if color_palette:
        prompt_parts.append(f"{color_palette} color palette")

    purpose_quality = {
        "social media": "vibrant colors, eye-catching",
        "web": "clean, professional, high resolution",
        "print": "ultra high resolution, print quality, sharp details",
        "art": "artistic, gallery quality, masterpiece",
        "general": "highly detailed, professional quality",
    }
    quality = purpose_quality.get(purpose.lower(), purpose_quality["general"])
    prompt_parts.append(quality)

    prompt = ", ".join(part for part in prompt_parts if part)

    return {"prompt": prompt}


@tool
def refine_prompt(current_draft: dict, feedback: str) -> dict:
    """Refine an existing prompt based on user feedback.

    Takes the current prompt draft and user feedback, then produces an updated
    version incorporating the requested changes. The agent (LLM) should modify
    the prompt based on the feedback and pass the updated value. The prompt
    should differ from the original draft.

    All prompt text must be in English regardless of the conversation language.

    Args:
        current_draft: Dict with current prompt. Expected key: 'prompt' (str).
        feedback: User feedback describing desired changes (e.g., "add dramatic lighting",
            "make it more vibrant", "add storm clouds").

    Returns:
        Dict with a single key 'prompt' (str).
    """
    prompt = current_draft.get("prompt", "")

    # If the agent provides a fully updated prompt in current_draft, use it.
    # The agent is expected to do the creative refinement and pass the result
    # through this tool for state update. The feedback string documents what
    # was changed for traceability.

    # Ensure prompt is a non-empty string
    if not prompt:
        prompt = feedback

    return {"prompt": str(prompt)}
