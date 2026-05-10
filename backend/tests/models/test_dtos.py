"""Acceptance tests for Slice 19: ReferenceSlotDTO + SendMessageRequest extension.

Tests are derived 1:1 from the GIVEN/WHEN/THEN Acceptance Criteria in
specs/2026-04-19-29-interactive-prompt-refinement-project-context/slices/
slice-19-reference-slots-dto.md.

Mocking Strategy: ``no_mocks`` (per Slice-Spec). Pydantic-Validation is purely
local; we instantiate real Pydantic models -- no mocks, no patches.
"""

from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.models.dtos import ReferenceSlotDTO, SendMessageRequest


# ---------------------------------------------------------------------------
# AC-1 .. AC-4: ReferenceSlotDTO validation
# ---------------------------------------------------------------------------


class TestReferenceSlotDTO:
    """Tests for the new ReferenceSlotDTO Pydantic model."""

    def test_accepts_full_payload(self):
        """AC-1: GIVEN ReferenceSlotDTO is defined as a new Pydantic model in
        backend/app/models/dtos.py
        WHEN a DTO with slot_index=2, image_url='https://example.com/img.png',
             role='style', strength=0.8 is instantiated
        THEN validation passes; all fields are retrievable; schema matches
             architecture.md -> Section 'Data Models' line 145.
        """
        dto = ReferenceSlotDTO(
            slot_index=2,
            image_url="https://example.com/img.png",
            role="style",
            strength=0.8,
        )

        assert dto.slot_index == 2
        # HttpUrl normalises -- compare via str()
        assert str(dto.image_url).startswith("https://example.com/img.png")
        assert dto.role == "style"
        assert dto.strength == 0.8

    def test_optional_role_and_strength_default_to_none(self):
        """AC-2: GIVEN ReferenceSlotDTO with role/strength as Optional fields
        WHEN a DTO is instantiated only with slot_index=0 and
             image_url='https://example.com/a.png' (no role, no strength)
        THEN validation passes; role is None; strength is None.
        """
        dto = ReferenceSlotDTO(
            slot_index=0,
            image_url="https://example.com/a.png",
        )

        assert dto.slot_index == 0
        assert dto.role is None
        assert dto.strength is None

    def test_rejects_strength_above_one(self):
        """AC-3: GIVEN ReferenceSlotDTO with strength: float (0.0..1.0) constraint
        WHEN a DTO with strength=1.5 is validated
        THEN ValidationError is raised with a hint about the value range.
        """
        with pytest.raises(ValidationError) as exc_info:
            ReferenceSlotDTO(
                slot_index=0,
                image_url="https://example.com/x.png",
                strength=1.5,
            )

        errors = exc_info.value.errors()
        assert any(err["loc"] == ("strength",) for err in errors)
        # Pydantic v2 emits 'less_than_equal' for le=1.0
        assert any(
            "less_than_equal" in err["type"] or "le" in str(err)
            for err in errors
        )

    def test_rejects_strength_below_zero(self):
        """AC-3 (supplement): the lower bound (ge=0.0) is also enforced."""
        with pytest.raises(ValidationError) as exc_info:
            ReferenceSlotDTO(
                slot_index=0,
                image_url="https://example.com/x.png",
                strength=-0.1,
            )

        errors = exc_info.value.errors()
        assert any(err["loc"] == ("strength",) for err in errors)

    def test_rejects_invalid_role(self):
        """AC-4: GIVEN ReferenceSlotDTO with role-Literal
              'subject' | 'style' | 'composition'
        WHEN a DTO with role='invalid' is validated
        THEN ValidationError is raised with a hint about the valid literals.
        """
        with pytest.raises(ValidationError) as exc_info:
            ReferenceSlotDTO(
                slot_index=0,
                image_url="https://example.com/x.png",
                role="invalid",
            )

        errors = exc_info.value.errors()
        assert any(err["loc"] == ("role",) for err in errors)
        # The error context should reference the allowed literals
        joined = " ".join(str(err) for err in errors)
        assert "subject" in joined
        assert "style" in joined
        assert "composition" in joined

    def test_accepts_each_valid_role_literal(self):
        """AC-4 (supplement): all three valid role literals are accepted."""
        for role in ("subject", "style", "composition"):
            dto = ReferenceSlotDTO(
                slot_index=0,
                image_url="https://example.com/x.png",
                role=role,
            )
            assert dto.role == role

    def test_rejects_negative_slot_index(self):
        """slot_index has ge=0 -- negative values are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            ReferenceSlotDTO(
                slot_index=-1,
                image_url="https://example.com/x.png",
            )

        errors = exc_info.value.errors()
        assert any(err["loc"] == ("slot_index",) for err in errors)

    def test_rejects_non_url_image_url(self):
        """image_url is HttpUrl -- non-URL strings are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            ReferenceSlotDTO(slot_index=0, image_url="not-a-url")

        errors = exc_info.value.errors()
        assert any(err["loc"] == ("image_url",) for err in errors)


# ---------------------------------------------------------------------------
# AC-5 .. AC-7: SendMessageRequest extended fields
# ---------------------------------------------------------------------------


class TestSendMessageRequestExtended:
    """Tests for the three new SendMessageRequest fields:
    project_id, reference_slots, last_result_image_url."""

    def test_accepts_project_and_slots_and_last_result(self):
        """AC-5: GIVEN SendMessageRequest is extended with
              project_id: UUID|None, reference_slots: list[ReferenceSlotDTO]|None
              (max_length=5), last_result_image_url: HttpUrl|None
        WHEN a request with content='Hallo' AND project_id=<UUID>
             AND reference_slots=[<3 valid DTOs>]
             AND last_result_image_url='https://s3.example.com/r.png' is validated
        THEN validation passes; all existing fields (content, image_urls, model,
             image_model_id, generation_mode) remain accepted unchanged
             (see architecture.md -> 'Data Models' line 146).
        """
        project_uuid = uuid4()
        slots = [
            ReferenceSlotDTO(
                slot_index=i,
                image_url=f"https://example.com/img{i}.png",
                role="subject",
                strength=0.5,
            )
            for i in range(3)
        ]

        req = SendMessageRequest(
            content="Hallo",
            image_urls=["https://example.com/a.png"],
            model="anthropic/claude-sonnet-4.6",
            image_model_id="flux-2-pro",
            generation_mode="img2img",
            project_id=project_uuid,
            reference_slots=slots,
            last_result_image_url="https://s3.example.com/r.png",
        )

        # New fields
        assert req.project_id == project_uuid
        assert req.reference_slots is not None
        assert len(req.reference_slots) == 3
        assert req.reference_slots[0].slot_index == 0
        assert req.reference_slots[2].slot_index == 2
        assert str(req.last_result_image_url).startswith(
            "https://s3.example.com/r.png"
        )

        # Existing fields untouched
        assert req.content == "Hallo"
        assert req.image_urls is not None and len(req.image_urls) == 1
        assert req.model == "anthropic/claude-sonnet-4.6"
        assert req.image_model_id == "flux-2-pro"
        assert req.generation_mode == "img2img"

    def test_rejects_more_than_five_reference_slots(self):
        """AC-6: GIVEN SendMessageRequest.reference_slots with max_length=5
        WHEN a request with 6 ReferenceSlotDTO entries is validated
        THEN validation fails; FastAPI endpoint would return 422.
        """
        slots = [
            ReferenceSlotDTO(
                slot_index=i,
                image_url=f"https://example.com/img{i}.png",
            )
            for i in range(6)
        ]

        with pytest.raises(ValidationError) as exc_info:
            SendMessageRequest(content="too many", reference_slots=slots)

        errors = exc_info.value.errors()
        assert any(err["loc"] == ("reference_slots",) for err in errors)
        joined = " ".join(str(err) for err in errors)
        assert "5" in joined or "max_length" in joined or "too_long" in joined

    def test_accepts_exactly_five_reference_slots(self):
        """AC-6 (boundary): exactly 5 slots is the maximum allowed value."""
        slots = [
            ReferenceSlotDTO(
                slot_index=i,
                image_url=f"https://example.com/img{i}.png",
            )
            for i in range(5)
        ]

        req = SendMessageRequest(content="five", reference_slots=slots)

        assert req.reference_slots is not None
        assert len(req.reference_slots) == 5

    def test_backward_compat_without_new_fields(self):
        """AC-7: GIVEN backward-compatibility requirement
        WHEN a request WITHOUT project_id, WITHOUT reference_slots,
             WITHOUT last_result_image_url (only existing fields) is validated
        THEN validation passes; all three new fields default to None.
        """
        req = SendMessageRequest(content="just text")

        assert req.project_id is None
        assert req.reference_slots is None
        assert req.last_result_image_url is None
        # Pre-existing optional fields also default to None
        assert req.image_urls is None
        assert req.model is None
        assert req.image_model_id is None
        assert req.generation_mode is None

    def test_rejects_invalid_project_id_uuid(self):
        """project_id is UUID -- non-UUID strings are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            SendMessageRequest(content="hi", project_id="not-a-uuid")

        errors = exc_info.value.errors()
        assert any(err["loc"] == ("project_id",) for err in errors)

    def test_rejects_invalid_last_result_image_url(self):
        """last_result_image_url is HttpUrl -- bare strings are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            SendMessageRequest(
                content="hi", last_result_image_url="not-a-url"
            )

        errors = exc_info.value.errors()
        assert any(err["loc"] == ("last_result_image_url",) for err in errors)

    def test_accepts_project_id_as_string_form(self):
        """Pydantic accepts a UUID string and coerces to UUID."""
        req = SendMessageRequest(
            content="hi",
            project_id="00000000-0000-4000-8000-000000000000",
        )
        assert req.project_id is not None
        assert str(req.project_id) == "00000000-0000-4000-8000-000000000000"

    def test_reference_slots_are_typed_dtos(self):
        """Each reference_slots item must be a valid ReferenceSlotDTO."""
        # Pydantic should reject malformed dicts in the list
        with pytest.raises(ValidationError):
            SendMessageRequest(
                content="hi",
                reference_slots=[
                    {
                        "slot_index": 0,
                        # Missing image_url
                    }
                ],
            )

    def test_reference_slots_can_be_empty_list(self):
        """An empty list is allowed (max_length=5 only enforces upper bound)."""
        req = SendMessageRequest(content="hi", reference_slots=[])
        assert req.reference_slots == []
