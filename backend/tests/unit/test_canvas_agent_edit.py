"""Unit tests for Canvas Agent Edit Extensions (Slice 06b).

Tests the canvas agent's edit-intent classification, mask-aware routing,
and generate_image tool extensions for inpaint/erase/instruction/outpaint actions.

Covers:
- CanvasImageContext DTO with mask_url field (AC-1, AC-2)
- build_canvas_system_prompt routing rules with/without mask (AC-3, AC-4, AC-5)
- generate_image tool with new actions and validation (AC-6 through AC-12)

Mocking Strategy: mock_external (as specified in Slice-Spec).
No LLM calls needed -- tests verify tool return values and prompt string content.
"""

import pytest


# ---------------------------------------------------------------------------
# AC-1, AC-2: CanvasImageContext DTO Tests
# ---------------------------------------------------------------------------


class TestCanvasImageContextMaskUrl:
    """Tests for the mask_url field on CanvasImageContext."""

    # AC-1: mask_url akzeptiert gueltige URL
    def test_canvas_image_context_accepts_valid_mask_url(self):
        """AC-1: GIVEN CanvasImageContext wird mit mask_url="https://r2.example.com/mask.png" instanziiert
        WHEN das Modell validiert wird
        THEN ist mask_url ein gueltiger Optional[HttpUrl] Wert und im model_dump() enthalten
        """
        from app.routes.canvas_sessions import CanvasImageContext

        ctx = CanvasImageContext(
            image_url="https://r2.example.com/image.png",
            prompt="a beautiful landscape",
            model_id="flux-2-max",
            model_params={},
            generation_id="abc-123",
            mask_url="https://r2.example.com/mask.png",
        )

        # mask_url must be present and valid
        assert ctx.mask_url is not None
        assert str(ctx.mask_url) == "https://r2.example.com/mask.png"

        # mask_url must appear in model_dump()
        dumped = ctx.model_dump(mode="json")
        assert "mask_url" in dumped
        assert dumped["mask_url"] == "https://r2.example.com/mask.png"

    # AC-2: mask_url ist optional und default None
    def test_canvas_image_context_mask_url_defaults_to_none(self):
        """AC-2: GIVEN CanvasImageContext wird ohne mask_url instanziiert
        WHEN das Modell validiert wird
        THEN ist mask_url gleich None (Default)
        """
        from app.routes.canvas_sessions import CanvasImageContext

        ctx = CanvasImageContext(
            image_url="https://r2.example.com/image.png",
            prompt="a beautiful landscape",
            model_id="flux-2-max",
            model_params={},
            generation_id="abc-123",
        )

        assert ctx.mask_url is None

        # model_dump should contain mask_url as None
        dumped = ctx.model_dump(mode="json")
        assert "mask_url" in dumped
        assert dumped["mask_url"] is None


# ---------------------------------------------------------------------------
# AC-3, AC-4, AC-5: System Prompt Tests
# ---------------------------------------------------------------------------


class TestBuildCanvasSystemPromptEditRouting:
    """Tests for edit-intent routing rules in build_canvas_system_prompt."""

    # AC-3: Prompt enthaelt inpaint-Routing-Regel wenn mask_url gesetzt
    def test_system_prompt_contains_inpaint_routing_when_mask_present(self):
        """AC-3: GIVEN ein image_context Dict mit mask_url gesetzt
        WHEN build_canvas_system_prompt(image_context) aufgerufen wird
        THEN enthaelt der zurueckgegebene Prompt-String die Routing-Regel:
             Mask vorhanden + Prompt -> action="inpaint"
        """
        from app.agent.canvas_graph import build_canvas_system_prompt

        image_context = {
            "image_url": "https://r2.example.com/image.png",
            "prompt": "a beautiful landscape",
            "model_id": "flux-2-max",
            "model_params": {},
            "mask_url": "https://r2.example.com/mask.png",
        }

        prompt = build_canvas_system_prompt(image_context)

        # Must contain the inpaint routing rule referencing mask presence + inpaint action
        assert "inpaint" in prompt.lower(), (
            "Prompt must mention 'inpaint' action when mask is present"
        )
        assert "mask" in prompt.lower(), (
            "Prompt must reference mask context when mask_url is set"
        )
        # The prompt should instruct to use action="inpaint" when mask + prompt present
        assert 'action="inpaint"' in prompt, (
            'Prompt must contain routing rule: action="inpaint" for mask + prompt'
        )

    # AC-4: Prompt enthaelt instruction-Routing-Regel wenn keine mask
    def test_system_prompt_contains_instruction_routing_when_no_mask(self):
        """AC-4: GIVEN ein image_context Dict ohne mask_url (oder mask_url=None)
        WHEN build_canvas_system_prompt(image_context) aufgerufen wird
        THEN enthaelt der zurueckgegebene Prompt-String die Routing-Regel:
             Keine Mask + Edit-Intent -> action="instruction"
        """
        from app.agent.canvas_graph import build_canvas_system_prompt

        image_context = {
            "image_url": "https://r2.example.com/image.png",
            "prompt": "a beautiful landscape",
            "model_id": "flux-2-max",
            "model_params": {},
            "mask_url": None,
        }

        prompt = build_canvas_system_prompt(image_context)

        # Must contain the instruction routing rule for no-mask edit intent
        assert 'action="instruction"' in prompt, (
            'Prompt must contain routing rule: action="instruction" for no-mask editing'
        )
        # Should mention that no mask is present
        assert "keine mask" in prompt.lower() or "no mask" in prompt.lower() or "keine maske" in prompt.lower(), (
            "Prompt must indicate no mask is present"
        )

    def test_system_prompt_contains_instruction_routing_when_mask_url_missing(self):
        """AC-4 variant: image_context without mask_url key at all should also
        route to instruction for edit intents.
        """
        from app.agent.canvas_graph import build_canvas_system_prompt

        image_context = {
            "image_url": "https://r2.example.com/image.png",
            "prompt": "a beautiful landscape",
            "model_id": "flux-2-max",
            "model_params": {},
        }

        prompt = build_canvas_system_prompt(image_context)

        assert 'action="instruction"' in prompt, (
            'Prompt must contain routing rule: action="instruction" when mask_url key is absent'
        )

    # AC-5: Prompt enthaelt outpaint-Routing-Regel
    def test_system_prompt_contains_outpaint_routing(self):
        """AC-5: GIVEN ein image_context Dict (beliebig)
        WHEN build_canvas_system_prompt(image_context) aufgerufen wird
        THEN enthaelt der zurueckgegebene Prompt-String die Routing-Regel:
             Outpaint-Kontext -> action="outpaint"
        """
        from app.agent.canvas_graph import build_canvas_system_prompt

        # Test with mask_url set
        image_context_with_mask = {
            "image_url": "https://r2.example.com/image.png",
            "prompt": "a beautiful landscape",
            "model_id": "flux-2-max",
            "model_params": {},
            "mask_url": "https://r2.example.com/mask.png",
        }

        prompt_with_mask = build_canvas_system_prompt(image_context_with_mask)
        assert 'action="outpaint"' in prompt_with_mask, (
            'Prompt must contain routing rule: action="outpaint" (with mask context)'
        )

        # Test without mask_url
        image_context_no_mask = {
            "image_url": "https://r2.example.com/image.png",
            "prompt": "a beautiful landscape",
            "model_id": "flux-2-max",
            "model_params": {},
        }

        prompt_no_mask = build_canvas_system_prompt(image_context_no_mask)
        assert 'action="outpaint"' in prompt_no_mask, (
            'Prompt must contain routing rule: action="outpaint" (without mask context)'
        )

    def test_system_prompt_without_context_contains_base_routing(self):
        """Baseline: build_canvas_system_prompt(None) should still contain
        the base routing rules for all actions including outpaint.
        """
        from app.agent.canvas_graph import build_canvas_system_prompt

        prompt = build_canvas_system_prompt(None)

        # The base prompt should contain routing rules for all actions
        assert 'action="outpaint"' in prompt, (
            'Base prompt must contain outpaint routing rule'
        )
        assert 'action="inpaint"' in prompt, (
            'Base prompt must contain inpaint routing rule'
        )
        assert 'action="instruction"' in prompt, (
            'Base prompt must contain instruction routing rule'
        )
        assert 'action="erase"' in prompt, (
            'Base prompt must contain erase routing rule'
        )


# ---------------------------------------------------------------------------
# AC-6 through AC-12: generate_image Tool Tests
# ---------------------------------------------------------------------------


class TestGenerateImageEditActions:
    """Tests for generate_image tool with new edit actions."""

    # AC-6: inpaint action mit mask_url
    def test_generate_image_inpaint_returns_mask_url(self):
        """AC-6: GIVEN generate_image wird mit action="inpaint", prompt="replace with red dress",
        model_id="black-forest-labs/flux-fill-pro", params={},
        mask_url="https://r2.example.com/mask.png" aufgerufen
        WHEN das Tool ausgefuehrt wird
        THEN gibt es ein Dict zurueck mit {"action": "inpaint", "prompt": "replace with red dress",
        "model_id": "black-forest-labs/flux-fill-pro", "params": {},
        "mask_url": "https://r2.example.com/mask.png"}
        """
        from app.agent.tools.image_tools import generate_image

        result = generate_image.invoke({
            "action": "inpaint",
            "prompt": "replace with red dress",
            "model_id": "black-forest-labs/flux-fill-pro",
            "params": {},
            "mask_url": "https://r2.example.com/mask.png",
        })

        assert isinstance(result, dict)
        assert result["action"] == "inpaint"
        assert result["prompt"] == "replace with red dress"
        assert result["model_id"] == "black-forest-labs/flux-fill-pro"
        assert result["params"] == {}
        assert result["mask_url"] == "https://r2.example.com/mask.png"

    # AC-7: erase action mit mask_url
    def test_generate_image_erase_returns_mask_url(self):
        """AC-7: GIVEN generate_image wird mit action="erase", prompt="",
        model_id="bria/eraser", params={},
        mask_url="https://r2.example.com/mask.png" aufgerufen
        WHEN das Tool ausgefuehrt wird
        THEN gibt es ein Dict zurueck mit {"action": "erase",
        "mask_url": "https://r2.example.com/mask.png"} (plus prompt, model_id, params)
        """
        from app.agent.tools.image_tools import generate_image

        result = generate_image.invoke({
            "action": "erase",
            "prompt": "",
            "model_id": "bria/eraser",
            "params": {},
            "mask_url": "https://r2.example.com/mask.png",
        })

        assert isinstance(result, dict)
        assert result["action"] == "erase"
        assert result["mask_url"] == "https://r2.example.com/mask.png"
        # Also verify prompt, model_id, params are present
        assert "prompt" in result
        assert "model_id" in result
        assert "params" in result
        assert result["model_id"] == "bria/eraser"

    # AC-8: outpaint action mit directions und size
    def test_generate_image_outpaint_returns_directions_and_size(self):
        """AC-8: GIVEN generate_image wird mit action="outpaint",
        prompt="extend with beach", model_id="black-forest-labs/flux-fill-pro",
        params={}, outpaint_directions=["top", "right"], outpaint_size=50 aufgerufen
        WHEN das Tool ausgefuehrt wird
        THEN gibt es ein Dict zurueck das outpaint_directions: ["top", "right"]
        und outpaint_size: 50 enthaelt
        """
        from app.agent.tools.image_tools import generate_image

        result = generate_image.invoke({
            "action": "outpaint",
            "prompt": "extend with beach",
            "model_id": "black-forest-labs/flux-fill-pro",
            "params": {},
            "outpaint_directions": ["top", "right"],
            "outpaint_size": 50,
        })

        assert isinstance(result, dict)
        assert result["action"] == "outpaint"
        assert result["outpaint_directions"] == ["top", "right"]
        assert result["outpaint_size"] == 50
        assert result["prompt"] == "extend with beach"
        assert result["model_id"] == "black-forest-labs/flux-fill-pro"

    # AC-9: instruction action ohne mask/outpaint params
    def test_generate_image_instruction_omits_mask_and_outpaint(self):
        """AC-9: GIVEN generate_image wird mit action="instruction",
        prompt="make sky bluer", model_id="black-forest-labs/flux-kontext-pro",
        params={} aufgerufen (ohne mask_url, ohne outpaint_*)
        WHEN das Tool ausgefuehrt wird
        THEN gibt es ein Dict zurueck mit action: "instruction"
        und OHNE mask_url, outpaint_directions, outpaint_size Schluessel
        (oder diese sind None)
        """
        from app.agent.tools.image_tools import generate_image

        result = generate_image.invoke({
            "action": "instruction",
            "prompt": "make sky bluer",
            "model_id": "black-forest-labs/flux-kontext-pro",
            "params": {},
        })

        assert isinstance(result, dict)
        assert result["action"] == "instruction"
        assert result["prompt"] == "make sky bluer"
        assert result["model_id"] == "black-forest-labs/flux-kontext-pro"

        # mask_url, outpaint_directions, outpaint_size must be absent or None
        mask_val = result.get("mask_url")
        outpaint_dirs_val = result.get("outpaint_directions")
        outpaint_size_val = result.get("outpaint_size")

        assert mask_val is None, (
            f"mask_url must be absent or None for instruction action, got: {mask_val}"
        )
        assert outpaint_dirs_val is None, (
            f"outpaint_directions must be absent or None for instruction action, got: {outpaint_dirs_val}"
        )
        assert outpaint_size_val is None, (
            f"outpaint_size must be absent or None for instruction action, got: {outpaint_size_val}"
        )

    # AC-10: ungueltige action faellt auf variation zurueck
    def test_generate_image_invalid_action_falls_back_to_variation(self):
        """AC-10: GIVEN generate_image wird mit action="invalid_action" aufgerufen
        WHEN das Tool ausgefuehrt wird
        THEN wird action auf "variation" zurueckgesetzt (Fallback, wie bisher)
        """
        from app.agent.tools.image_tools import generate_image

        result = generate_image.invoke({
            "action": "invalid_action",
            "prompt": "test prompt",
            "model_id": "flux-2-max",
            "params": {},
        })

        assert isinstance(result, dict)
        assert result["action"] == "variation", (
            f"Invalid action must fall back to 'variation', got: {result['action']}"
        )

    # AC-11: inpaint ohne mask_url gibt error zurueck
    def test_generate_image_inpaint_without_mask_returns_error(self):
        """AC-11: GIVEN generate_image wird mit action="inpaint" aber ohne mask_url aufgerufen
        WHEN das Tool ausgefuehrt wird
        THEN gibt das Tool ein Error-Dict zurueck:
             {"error": "mask_url is required for inpaint action"}
        """
        from app.agent.tools.image_tools import generate_image

        result = generate_image.invoke({
            "action": "inpaint",
            "prompt": "replace with something",
            "model_id": "black-forest-labs/flux-fill-pro",
            "params": {},
        })

        assert isinstance(result, dict)
        assert "error" in result, (
            "inpaint without mask_url must return an error dict"
        )
        assert result["error"] == "mask_url is required for inpaint action"

    # AC-12: outpaint ohne directions gibt error zurueck
    def test_generate_image_outpaint_without_directions_returns_error(self):
        """AC-12: GIVEN generate_image wird mit action="outpaint" aber ohne
        outpaint_directions aufgerufen
        WHEN das Tool ausgefuehrt wird
        THEN gibt das Tool ein Error-Dict zurueck:
             {"error": "outpaint_directions is required for outpaint action"}
        """
        from app.agent.tools.image_tools import generate_image

        result = generate_image.invoke({
            "action": "outpaint",
            "prompt": "extend the scene",
            "model_id": "black-forest-labs/flux-fill-pro",
            "params": {},
        })

        assert isinstance(result, dict)
        assert "error" in result, (
            "outpaint without outpaint_directions must return an error dict"
        )
        assert result["error"] == "outpaint_directions is required for outpaint action"


# ---------------------------------------------------------------------------
# Backward Compatibility Tests (from Constraints)
# ---------------------------------------------------------------------------


class TestGenerateImageBackwardCompatibility:
    """Verify existing variation and img2img actions still work unchanged."""

    def test_variation_action_still_works(self):
        """Backward compat: action=variation must still return correct structure."""
        from app.agent.tools.image_tools import generate_image

        result = generate_image.invoke({
            "action": "variation",
            "prompt": "A beautiful sunset",
            "model_id": "flux-2-max",
            "params": {},
        })

        assert isinstance(result, dict)
        assert result["action"] == "variation"
        assert result["prompt"] == "A beautiful sunset"
        assert result["model_id"] == "flux-2-max"
        assert result["params"] == {}

    def test_img2img_action_still_works(self):
        """Backward compat: action=img2img with params must still work."""
        from app.agent.tools.image_tools import generate_image

        result = generate_image.invoke({
            "action": "img2img",
            "prompt": "More dramatic lighting",
            "model_id": "flux-1.1-pro",
            "params": {"strength": 0.7},
        })

        assert isinstance(result, dict)
        assert result["action"] == "img2img"
        assert result["model_id"] == "flux-1.1-pro"
        assert result["params"] == {"strength": 0.7}


# ---------------------------------------------------------------------------
# Edge Case / Validation Tests (from Constraints)
# ---------------------------------------------------------------------------


class TestGenerateImageValidation:
    """Additional validation tests for edge cases from Constraints section."""

    def test_erase_without_mask_returns_error(self):
        """Erase action also requires mask_url (like inpaint)."""
        from app.agent.tools.image_tools import generate_image

        result = generate_image.invoke({
            "action": "erase",
            "prompt": "",
            "model_id": "bria/eraser",
            "params": {},
        })

        assert isinstance(result, dict)
        assert "error" in result
        assert "mask_url" in result["error"].lower()

    def test_outpaint_invalid_direction_returns_error(self):
        """outpaint_directions must be subset of ["top", "bottom", "left", "right"]."""
        from app.agent.tools.image_tools import generate_image

        result = generate_image.invoke({
            "action": "outpaint",
            "prompt": "extend scene",
            "model_id": "black-forest-labs/flux-fill-pro",
            "params": {},
            "outpaint_directions": ["top", "diagonal"],
        })

        assert isinstance(result, dict)
        assert "error" in result
        assert "diagonal" in result["error"]

    def test_outpaint_invalid_size_returns_error(self):
        """outpaint_size must be in [25, 50, 100]."""
        from app.agent.tools.image_tools import generate_image

        result = generate_image.invoke({
            "action": "outpaint",
            "prompt": "extend scene",
            "model_id": "black-forest-labs/flux-fill-pro",
            "params": {},
            "outpaint_directions": ["top"],
            "outpaint_size": 75,
        })

        assert isinstance(result, dict)
        assert "error" in result
        assert "75" in result["error"]

    def test_valid_actions_constant_contains_all_six(self):
        """VALID_GENERATE_ACTIONS must contain all 6 valid action values."""
        from app.agent.tools.image_tools import VALID_GENERATE_ACTIONS

        expected = {"variation", "img2img", "inpaint", "erase", "instruction", "outpaint"}
        assert set(VALID_GENERATE_ACTIONS) == expected, (
            f"VALID_GENERATE_ACTIONS must be {expected}, got {set(VALID_GENERATE_ACTIONS)}"
        )
