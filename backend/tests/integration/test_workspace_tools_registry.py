"""Integration tests for workspace_tools registration in graph.py (Slice 23).

Verifies that the three new workspace tools are properly registered in
``ALL_TOOLS`` and that they intentionally do NOT participate in
``TOOL_STATE_MAPPING`` (or ``TOOL_APPEND_MAPPING`` / ``TOOL_FLOW_STATE_MAPPING``
/ ``TOOL_PAYLOAD_FROM_ARGS``) — per Architecture Q17 these tools do not
persist into LangGraph state; the UI is the authoritative slot owner.

Also re-asserts that previously-registered tools from Slices 12 and 13
remain present after the Slice 23 changes (regression guard).

Mocking Strategy: ``no_mocks`` per Slice-Spec. ``ALL_TOOLS`` and the
``TOOL_*_MAPPING`` constants are pure Python module-level data.

Source ACs: specs/.../slice-23-i2i-settings-tools.md (AC-10).
"""

from __future__ import annotations


# ---------------------------------------------------------------------------
# AC-10: ALL_TOOLS contains the three new tools and TOOL_STATE_MAPPING is
# unchanged for them.
# ---------------------------------------------------------------------------


WORKSPACE_TOOL_NAMES = {
    "set_slot_role",
    "set_slot_strength",
    "set_model_params",
}


class TestAllToolsRegistryContainsWorkspaceTools:
    """AC-10: GIVEN alle drei Tools sind in ``backend/app/agent/graph.py``
    registriert
    WHEN ``from app.agent.graph import ALL_TOOLS, TOOL_STATE_MAPPING``
    ausgefuehrt wird
    THEN alle drei Namen sind in ``[t.name for t in ALL_TOOLS]`` enthalten;
    KEINER der drei Namen ist Schluessel in ``TOOL_STATE_MAPPING`` (Tools
    persistieren NICHT im State).
    """

    def test_all_tools_registry_contains_workspace_tools(self):
        """AC-10: ALL_TOOLS MUST contain the three workspace tools."""
        from app.agent.graph import ALL_TOOLS

        tool_names = [t.name for t in ALL_TOOLS]
        for required in WORKSPACE_TOOL_NAMES:
            assert required in tool_names, (
                f"ALL_TOOLS must register '{required}' (Slice 23); "
                f"current registry: {tool_names}"
            )

    def test_workspace_tools_are_basetool_instances(self):
        """AC-10: ``ALL_TOOLS`` entries for workspace tools are real BaseTool
        objects (not bare functions)."""
        from langchain_core.tools import BaseTool

        from app.agent.graph import ALL_TOOLS

        by_name = {t.name: t for t in ALL_TOOLS}
        for required in WORKSPACE_TOOL_NAMES:
            tool = by_name.get(required)
            assert tool is not None, (
                f"Tool '{required}' missing from ALL_TOOLS"
            )
            assert isinstance(tool, BaseTool), (
                f"Tool '{required}' must be a BaseTool, "
                f"got {type(tool).__name__}"
            )

    def test_no_duplicate_workspace_tool_registrations(self):
        """AC-10: Each workspace tool name appears exactly once in ALL_TOOLS."""
        from app.agent.graph import ALL_TOOLS

        tool_names = [t.name for t in ALL_TOOLS]
        for required in WORKSPACE_TOOL_NAMES:
            count = tool_names.count(required)
            assert count == 1, (
                f"Tool '{required}' must be registered exactly once in "
                f"ALL_TOOLS, found {count} occurrences in {tool_names}"
            )


class TestToolStateMappingDoesNotIncludeWorkspaceTools:
    """AC-10: KEINER der drei Workspace-Tool-Namen ist Schluessel in
    ``TOOL_STATE_MAPPING``. Tools persistieren NICHT im State —
    Architecture Q17 bestaetigt: UI ist authoritative Slot-Quelle.
    """

    def test_tool_state_mapping_does_not_include_workspace_tools(self):
        """AC-10: TOOL_STATE_MAPPING MUST NOT contain workspace tool names."""
        from app.agent.graph import TOOL_STATE_MAPPING

        for forbidden in WORKSPACE_TOOL_NAMES:
            assert forbidden not in TOOL_STATE_MAPPING, (
                f"TOOL_STATE_MAPPING MUST NOT contain '{forbidden}' "
                f"(Slice 23: workspace tools have no state effect, "
                f"Architecture Q17). "
                f"Current keys: {list(TOOL_STATE_MAPPING)}"
            )

    def test_tool_append_mapping_does_not_include_workspace_tools(self):
        """AC-10: TOOL_APPEND_MAPPING MUST NOT contain workspace tool names."""
        from app.agent.graph import TOOL_APPEND_MAPPING

        for forbidden in WORKSPACE_TOOL_NAMES:
            assert forbidden not in TOOL_APPEND_MAPPING, (
                f"TOOL_APPEND_MAPPING MUST NOT contain '{forbidden}'; "
                f"current keys: {list(TOOL_APPEND_MAPPING)}"
            )

    def test_tool_flow_state_mapping_does_not_include_workspace_tools(self):
        """AC-10: TOOL_FLOW_STATE_MAPPING MUST NOT contain workspace tool names.

        Workspace tools must NOT trigger an FSM transition (e.g. into
        'summarizing'); only emit_intent_summary owns that behavior.
        """
        try:
            from app.agent.graph import TOOL_FLOW_STATE_MAPPING
        except ImportError:
            # Mapping introduced by Slice 13; if absent in this branch the
            # constraint is trivially satisfied.
            return

        for forbidden in WORKSPACE_TOOL_NAMES:
            assert forbidden not in TOOL_FLOW_STATE_MAPPING, (
                f"TOOL_FLOW_STATE_MAPPING MUST NOT contain '{forbidden}'; "
                f"current keys: {list(TOOL_FLOW_STATE_MAPPING)}"
            )

    def test_tool_payload_from_args_mapping_does_not_include_workspace_tools(self):
        """AC-10: TOOL_PAYLOAD_FROM_ARGS MUST NOT contain workspace tool names.

        Per Slice 23 these tools have no payload-persistence into state.
        """
        try:
            from app.agent.graph import TOOL_PAYLOAD_FROM_ARGS
        except ImportError:
            return  # mapping is Slice-13 specific; absence is OK

        for forbidden in WORKSPACE_TOOL_NAMES:
            assert forbidden not in TOOL_PAYLOAD_FROM_ARGS, (
                f"TOOL_PAYLOAD_FROM_ARGS MUST NOT contain '{forbidden}'; "
                f"current keys: {list(TOOL_PAYLOAD_FROM_ARGS)}"
            )


class TestExistingToolsStillRegisteredAfterWorkspaceTools:
    """AC-10: Bestehende Eintraege aus Slice 13 (`emit_intent_summary` →
    `summarizing`) bleiben unveraendert; bestehende Tools aus Slice 12
    (`draft_prompt`, `refine_prompt`, `analyze_image`, `recommend_model`,
    `get_model_info`, `web_search`) bleiben in ``ALL_TOOLS``.
    """

    def test_existing_tools_still_registered_after_workspace_tools_added(self):
        """AC-10: All Slice 12/13 tools remain in ALL_TOOLS."""
        from app.agent.graph import ALL_TOOLS

        tool_names = [t.name for t in ALL_TOOLS]
        # Slice 12 tools
        for required in (
            "draft_prompt",
            "refine_prompt",
            "analyze_image",
            "recommend_model",
            "get_model_info",
            "web_search",
        ):
            assert required in tool_names, (
                f"Slice 12 tool '{required}' must still be registered after "
                f"Slice 23 changes; current registry: {tool_names}"
            )
        # Slice 13 tool
        assert "emit_intent_summary" in tool_names, (
            f"Slice 13 tool 'emit_intent_summary' must still be registered "
            f"after Slice 23 changes; current registry: {tool_names}"
        )

    def test_emit_intent_summary_state_mapping_unchanged(self):
        """AC-10: TOOL_STATE_MAPPING['emit_intent_summary'] is preserved."""
        from app.agent.graph import TOOL_STATE_MAPPING

        assert TOOL_STATE_MAPPING.get("emit_intent_summary") == "summarizing", (
            f"Slice 13 mapping for emit_intent_summary must remain "
            f"'summarizing'; got "
            f"{TOOL_STATE_MAPPING.get('emit_intent_summary')!r}"
        )

    def test_existing_state_mappings_from_slice_12_unchanged(self):
        """AC-10: Slice 12 TOOL_STATE_MAPPING entries are preserved."""
        from app.agent.graph import TOOL_STATE_MAPPING

        expected = {
            "draft_prompt": "draft_prompt",
            "refine_prompt": "draft_prompt",
            "analyze_image": "reference_images",
            "recommend_model": "recommended_model",
        }
        for key, value in expected.items():
            assert TOOL_STATE_MAPPING.get(key) == value, (
                f"TOOL_STATE_MAPPING['{key}'] must remain '{value}' after "
                f"Slice 23 changes; got {TOOL_STATE_MAPPING.get(key)!r}"
            )

    def test_total_tool_count_includes_workspace_tools(self):
        """AC-10: Sanity check -- ALL_TOOLS contains at least the 7 expected
        pre-slice-23 tools PLUS the 3 workspace tools = 10 minimum."""
        from app.agent.graph import ALL_TOOLS

        # 6 tools from Slice 12 + 1 tool from Slice 13 + 3 from Slice 23 = 10
        # We don't pin an exact value (future slices may extend), but the
        # registry must contain at least these 10 known names.
        required = (
            WORKSPACE_TOOL_NAMES
            | {
                "draft_prompt",
                "refine_prompt",
                "analyze_image",
                "recommend_model",
                "get_model_info",
                "web_search",
                "emit_intent_summary",
            }
        )
        tool_names = {t.name for t in ALL_TOOLS}
        missing = required - tool_names
        assert not missing, (
            f"ALL_TOOLS missing expected tools: {missing}; "
            f"current registry: {sorted(tool_names)}"
        )
