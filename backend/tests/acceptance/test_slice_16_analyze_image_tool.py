"""Acceptance tests for Slice 16: analyze_image Tool (Backend).

Tests are derived 1:1 from the GIVEN/WHEN/THEN Acceptance Criteria in
specs/phase-3/2026-03-11-prompt-assistant/slices/slice-16-analyze-image-tool.md.

Mocking Strategy: mock_external (as specified in Slice-Spec).
HTTP downloads and Vision LLM calls are mocked; all other components
(tools, graph, post_process_node, SSE conversion) use real instances.
"""

import io
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from PIL import Image


class TestSlice16Acceptance:
    """Acceptance tests for Slice 16 - analyze_image Tool."""

    @pytest.mark.acceptance
    @pytest.mark.asyncio
    async def test_ac1_analyze_image_returns_structured_dict_with_six_keys(self):
        """AC-1: GIVEN ein registriertes analyze_image Tool im LangGraph Agent
        WHEN der Agent das Tool mit einer gueltigen image_url aufruft
        (z.B. "https://r2.example.com/images/photo.jpg")
        THEN gibt das Tool ein Dict mit genau sechs Keys zurueck:
        subject (non-empty string), style (non-empty string), mood (non-empty string),
        lighting (non-empty string), composition (non-empty string), palette (non-empty string)
        """
        from app.agent.tools.image_tools import analyze_image

        # Arrange (GIVEN): analyze_image is a registered LangGraph tool
        assert hasattr(analyze_image, "ainvoke"), (
            "analyze_image must be a callable LangGraph tool"
        )

        # Create a real test image
        img = Image.new("RGB", (800, 600), color="green")
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        fake_image_bytes = buf.getvalue()

        mock_response = MagicMock()
        mock_response.content = fake_image_bytes
        mock_response.headers = {"content-type": "image/jpeg"}
        mock_response.raise_for_status = MagicMock()

        vision_result = json.dumps({
            "subject": "lush green field",
            "style": "photorealistic",
            "mood": "peaceful",
            "lighting": "soft diffused daylight",
            "composition": "wide panoramic view",
            "palette": "various shades of green",
        })
        mock_llm_response = MagicMock()
        mock_llm_response.content = vision_result

        with patch("app.agent.tools.image_tools.httpx.AsyncClient") as mock_client_cls, \
             patch("app.agent.tools.image_tools.ChatOpenAI") as mock_chat_cls:

            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            mock_llm = MagicMock()
            mock_llm.ainvoke = AsyncMock(return_value=mock_llm_response)
            mock_chat_cls.return_value = mock_llm

            # Act (WHEN): Call the tool with a valid image_url
            result = await analyze_image.ainvoke(
                {"image_url": "https://r2.example.com/images/photo.jpg"}
            )

        # Assert (THEN): Returns dict with exactly six non-empty string keys
        assert isinstance(result, dict), (
            f"analyze_image must return a dict, got {type(result).__name__}"
        )
        expected_keys = {"subject", "style", "mood", "lighting", "composition", "palette"}
        assert set(result.keys()) == expected_keys, (
            f"analyze_image must return exactly keys {expected_keys}, "
            f"got {set(result.keys())}"
        )

        for key in expected_keys:
            assert isinstance(result[key], str), (
                f"'{key}' must be a string, got {type(result[key]).__name__}"
            )
            assert len(result[key]) > 0, (
                f"'{key}' must be non-empty"
            )

    @pytest.mark.acceptance
    def test_ac2_image_larger_than_1024_is_downscaled(self):
        """AC-2: GIVEN ein Bild mit 2048x1536px an der uebergebenen URL
        WHEN analyze_image das Bild herunterlaed und verarbeitet
        THEN wird das Bild auf 1024x768px skaliert (laengste Kante = 1024px,
        Seitenverhaeltnis beibehalten) bevor es an die Vision-API gesendet wird
        """
        from app.agent.tools.image_tools import _resize_image_if_needed

        # Arrange (GIVEN): A 2048x1536 image
        img = Image.new("RGB", (2048, 1536), color="red")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        image_bytes = buf.getvalue()

        # Act (WHEN): Process the image through resize logic
        processed_bytes, mime_type = _resize_image_if_needed(image_bytes)

        # Assert (THEN): Image is resized to 1024x768 (longest edge = 1024, aspect ratio preserved)
        processed_img = Image.open(io.BytesIO(processed_bytes))
        assert processed_img.size == (1024, 768), (
            f"Image must be resized to 1024x768, got {processed_img.size}"
        )
        assert mime_type == "image/png"

    @pytest.mark.acceptance
    def test_ac3_image_smaller_than_1024_not_resized(self):
        """AC-3: GIVEN ein Bild mit 800x600px (bereits unter 1024px)
        WHEN analyze_image das Bild verarbeitet
        THEN wird das Bild NICHT skaliert (Originalgroesse beibehalten)
        """
        from app.agent.tools.image_tools import _resize_image_if_needed

        # Arrange (GIVEN): An 800x600 image (already under 1024px)
        img = Image.new("RGB", (800, 600), color="blue")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        image_bytes = buf.getvalue()

        # Act (WHEN): Process the image
        processed_bytes, mime_type = _resize_image_if_needed(image_bytes)

        # Assert (THEN): Image is NOT resized (original size preserved)
        processed_img = Image.open(io.BytesIO(processed_bytes))
        assert processed_img.size == (800, 600), (
            f"Image must stay at 800x600 (not resized), got {processed_img.size}"
        )

    @pytest.mark.acceptance
    def test_ac4_post_process_node_appends_to_reference_images(self):
        """AC-4: GIVEN der Agent hat analyze_image ausgefuehrt
        WHEN der post_process_node nach dem Tools-Node laeuft
        THEN wird ein neues Entry {"url": "<image_url>", "analysis": <tool_result>}
        an state["reference_images"] angehaengt (append, nicht ueberschreiben)
        """
        from app.agent.graph import post_process_node

        # Arrange (GIVEN): Agent has executed analyze_image, existing images present
        existing_entry = {
            "url": "https://r2.example.com/images/first.jpg",
            "analysis": {
                "subject": "landscape",
                "style": "watercolor",
                "mood": "calm",
                "lighting": "diffused",
                "composition": "wide",
                "palette": "blues",
            },
        }

        new_analysis = {
            "subject": "portrait of a woman",
            "style": "oil painting",
            "mood": "mysterious",
            "lighting": "dramatic chiaroscuro",
            "composition": "close-up centered",
            "palette": "dark moody tones",
        }
        new_url = "https://r2.example.com/images/second.jpg"

        state = {
            "messages": [
                HumanMessage(content="Analyze this second image"),
                AIMessage(
                    content="",
                    tool_calls=[{
                        "id": "call_ac4",
                        "name": "analyze_image",
                        "args": {"image_url": new_url},
                    }],
                ),
                ToolMessage(
                    content=json.dumps(new_analysis),
                    name="analyze_image",
                    tool_call_id="call_ac4",
                ),
            ],
            "reference_images": [existing_entry],
        }

        # Act (WHEN): post_process_node runs after the tools node
        updates = post_process_node(state)

        # Assert (THEN): New entry appended, existing entry preserved
        assert "reference_images" in updates, (
            "post_process_node must produce a 'reference_images' update"
        )
        ref_images = updates["reference_images"]
        assert len(ref_images) == 2, (
            f"reference_images must have 2 entries (existing + new), got {len(ref_images)}"
        )

        # First entry preserved
        assert ref_images[0] == existing_entry, (
            "Existing reference_images entry must be preserved"
        )

        # New entry appended with correct structure
        new_entry = ref_images[1]
        assert new_entry["url"] == new_url, (
            f"New entry url must be '{new_url}', got '{new_entry['url']}'"
        )
        assert new_entry["analysis"] == new_analysis, (
            "New entry analysis must match tool result"
        )

    @pytest.mark.acceptance
    def test_ac5_sse_event_tool_call_result_for_analyze_image(self):
        """AC-5: GIVEN ein aktiver SSE-Stream und der Agent ruft analyze_image auf
        WHEN das Tool-Ergebnis vorliegt
        THEN wird ein SSE-Event event: tool-call-result mit
        data: {"tool": "analyze_image", "data": {"subject": "...", "style": "...",
        "mood": "...", "lighting": "...", "composition": "...", "palette": "..."}}
        gesendet
        """
        from app.services.assistant_service import AssistantService

        # Arrange (GIVEN): AssistantService with mocked agent for SSE conversion
        with patch("app.services.assistant_service.create_agent"):
            service = AssistantService()

        analysis_data = {
            "subject": "a golden retriever in a meadow",
            "style": "photorealistic",
            "mood": "joyful",
            "lighting": "warm afternoon sun",
            "composition": "rule of thirds, dog off-center",
            "palette": "warm greens and golden tones",
        }

        # Simulate an on_tool_end event from LangGraph astream_events
        langgraph_event = {
            "event": "on_tool_end",
            "name": "analyze_image",
            "data": {"output": analysis_data},
        }

        # Act (WHEN): Convert the LangGraph event to SSE event
        sse_event = service._convert_event(langgraph_event)

        # Assert (THEN): SSE event has correct format
        assert sse_event is not None, (
            "on_tool_end for analyze_image must produce an SSE event"
        )
        assert sse_event["event"] == "tool-call-result", (
            f"SSE event type must be 'tool-call-result', got '{sse_event['event']}'"
        )

        data = json.loads(sse_event["data"])
        assert data["tool"] == "analyze_image", (
            f"SSE payload tool must be 'analyze_image', got '{data['tool']}'"
        )
        assert "data" in data, "SSE payload must contain 'data' key"

        expected_keys = {"subject", "style", "mood", "lighting", "composition", "palette"}
        assert set(data["data"].keys()) == expected_keys, (
            f"SSE data.data must have {expected_keys}, got {set(data['data'].keys())}"
        )

        # Verify all values match the tool output
        for key in expected_keys:
            assert data["data"][key] == analysis_data[key], (
                f"SSE data.data['{key}'] must be '{analysis_data[key]}', "
                f"got '{data['data'][key]}'"
            )

    @pytest.mark.acceptance
    @pytest.mark.asyncio
    async def test_ac6_invalid_url_gives_meaningful_error(self):
        """AC-6: GIVEN eine ungueltige oder nicht erreichbare image_url
        WHEN analyze_image den Download versucht
        THEN wirft das Tool einen aussagekraeftigen Fehler
        (z.B. "Bild konnte nicht heruntergeladen werden")
        """
        from app.agent.tools.image_tools import _download_image

        import httpx

        # Arrange (GIVEN): An unreachable URL
        with patch("app.agent.tools.image_tools.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(
                side_effect=httpx.RequestError(
                    "Name resolution failed",
                    request=MagicMock(),
                )
            )
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            # Act & Assert (WHEN/THEN): Download raises meaningful error
            with pytest.raises(ValueError) as exc_info:
                await _download_image("https://nonexistent-host.example.com/img.jpg")

            error_msg = str(exc_info.value)
            assert "Bild konnte nicht heruntergeladen werden" in error_msg, (
                f"Error message must contain 'Bild konnte nicht heruntergeladen werden', "
                f"got: '{error_msg}'"
            )

    @pytest.mark.acceptance
    @pytest.mark.asyncio
    async def test_ac6_http_error_gives_meaningful_error(self):
        """AC-6 (additional): HTTP 404 must produce meaningful error message."""
        from app.agent.tools.image_tools import _download_image

        import httpx

        # Arrange (GIVEN): URL returns 404
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            message="Not Found",
            request=MagicMock(),
            response=mock_response,
        )

        with patch("app.agent.tools.image_tools.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            # Act & Assert (WHEN/THEN)
            with pytest.raises(ValueError) as exc_info:
                await _download_image("https://r2.example.com/images/missing.jpg")

            error_msg = str(exc_info.value)
            assert "Bild konnte nicht heruntergeladen werden" in error_msg
            assert "404" in error_msg, (
                f"Error message should contain HTTP status code, got: '{error_msg}'"
            )

    @pytest.mark.acceptance
    def test_ac7_analyze_image_registered_in_agent(self):
        """AC-7: GIVEN analyze_image als registriertes Tool
        WHEN der kompilierte Agent-Graph inspiziert wird
        THEN ist analyze_image im tools-Array des Agents enthalten und der Graph
        kompiliert ohne Fehler (zusaetzlich zu den bestehenden draft_prompt und
        refine_prompt Tools aus Slice 12)
        """
        from app.agent.graph import ALL_TOOLS

        # Arrange (GIVEN): Tools are registered in ALL_TOOLS
        tool_names = [t.name for t in ALL_TOOLS]

        # Assert (THEN): analyze_image is present alongside existing tools
        assert "analyze_image" in tool_names, (
            "analyze_image must be registered in ALL_TOOLS"
        )
        assert "draft_prompt" in tool_names, (
            "draft_prompt must still be registered (from Slice 12)"
        )
        assert "refine_prompt" in tool_names, (
            "refine_prompt must still be registered (from Slice 12)"
        )

        # Verify graph compiles without error
        with patch("app.agent.graph.ChatOpenAI") as mock_chat:
            mock_llm = MagicMock()
            mock_llm.bind_tools = MagicMock(return_value=mock_llm)
            mock_chat.return_value = mock_llm

            from app.agent.graph import create_agent

            graph = create_agent()

        assert graph is not None, "Graph must compile without errors"
        assert hasattr(graph, "invoke"), "Compiled graph must have invoke method"
        assert hasattr(graph, "ainvoke"), "Compiled graph must have ainvoke method"

    @pytest.mark.acceptance
    def test_ac8_malformed_vision_response_handled_gracefully(self):
        """AC-8: GIVEN die Vision-API-Antwort des LLM
        WHEN die Antwort nicht als strukturiertes JSON mit den erwarteten 6 Keys
        geparst werden kann
        THEN gibt das Tool einen Fallback mit den Keys zurueck
        (leere Strings fuer fehlende Felder) oder einen klaren Fehlermeldung
        """
        from app.agent.tools.image_tools import _parse_vision_response

        expected_keys = {"subject", "style", "mood", "lighting", "composition", "palette"}

        # Case 1: Completely unparseable text
        result_garbage = _parse_vision_response(
            "I cannot analyze this image because it is too abstract."
        )
        assert isinstance(result_garbage, dict), "Fallback must be a dict"
        assert set(result_garbage.keys()) == expected_keys, (
            f"Fallback must have all 6 keys, got {set(result_garbage.keys())}"
        )

        # Case 2: Valid JSON but missing keys
        result_partial = _parse_vision_response(
            json.dumps({"subject": "tree", "style": "sketch"})
        )
        assert set(result_partial.keys()) == expected_keys
        assert result_partial["subject"] == "tree"
        assert result_partial["style"] == "sketch"
        assert result_partial["mood"] == "", "Missing 'mood' must default to empty string"
        assert result_partial["lighting"] == "", "Missing 'lighting' must default to empty string"
        assert result_partial["composition"] == "", "Missing 'composition' must default to empty string"
        assert result_partial["palette"] == "", "Missing 'palette' must default to empty string"

        # Case 3: JSON wrapped in markdown code fences
        result_fenced = _parse_vision_response(
            '```json\n{"subject": "dog", "style": "photo", "mood": "happy", '
            '"lighting": "sun", "composition": "center", "palette": "warm"}\n```'
        )
        assert result_fenced["subject"] == "dog"
        assert result_fenced["mood"] == "happy"

        # Case 4: Empty string
        result_empty = _parse_vision_response("")
        assert set(result_empty.keys()) == expected_keys
        for key in expected_keys:
            assert result_empty[key] == "", f"Empty input must produce empty string for '{key}'"

    @pytest.mark.acceptance
    @pytest.mark.asyncio
    async def test_ac8_full_tool_with_malformed_llm_response(self):
        """AC-8 (full pipeline): When the Vision LLM returns unparseable text,
        the tool must still return a dict with all 6 keys (empty strings as fallback).
        """
        from app.agent.tools.image_tools import analyze_image

        # Create a small test image
        img = Image.new("RGB", (100, 100), color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        fake_image_bytes = buf.getvalue()

        mock_response = MagicMock()
        mock_response.content = fake_image_bytes
        mock_response.headers = {"content-type": "image/png"}
        mock_response.raise_for_status = MagicMock()

        # LLM returns non-JSON garbage
        mock_llm_response = MagicMock()
        mock_llm_response.content = "I'm sorry, I cannot analyze this image. It appears to be blank."

        with patch("app.agent.tools.image_tools.httpx.AsyncClient") as mock_client_cls, \
             patch("app.agent.tools.image_tools.ChatOpenAI") as mock_chat_cls:

            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            mock_llm = MagicMock()
            mock_llm.ainvoke = AsyncMock(return_value=mock_llm_response)
            mock_chat_cls.return_value = mock_llm

            result = await analyze_image.ainvoke(
                {"image_url": "https://r2.example.com/images/blank.png"}
            )

        # Even with garbage LLM response, must return dict with 6 keys
        assert isinstance(result, dict)
        expected_keys = {"subject", "style", "mood", "lighting", "composition", "palette"}
        assert set(result.keys()) == expected_keys, (
            f"Fallback must have all 6 keys, got {set(result.keys())}"
        )
