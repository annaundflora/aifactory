import pytest


# AC-2: Alle pytest-Suites gruen
@pytest.mark.skip(reason="AC-2")
def test_all_pytest_suites_pass():
    ...


# AC-4: DB-Migration -- Spalten entfernt, bestehende Rows intakt
@pytest.mark.skip(reason="AC-4")
def test_migration_drops_prompt_style_negative_columns_and_preserves_rows():
    ...


# AC-7: draft_prompt Tool gibt { prompt } zurueck
@pytest.mark.skip(reason="AC-7")
def test_draft_prompt_returns_single_field():
    ...
