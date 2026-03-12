"""Acceptance tests for Slice 01: Python Projekt-Setup.

Tests are derived 1:1 from the GIVEN/WHEN/THEN Acceptance Criteria
in specs/phase-3/2026-03-11-prompt-assistant/slices/slice-01-python-projekt-setup.md.

Mocking Strategy: no_mocks (as specified in Slice-Spec).
"""

import importlib
import pathlib
import subprocess
import sys

import pytest

# Root of the backend directory (two levels up from this test file)
BACKEND_ROOT = pathlib.Path(__file__).resolve().parent.parent.parent


class TestSlice01Acceptance:
    """Acceptance tests for Slice 01 - Python Projekt-Setup."""

    def test_ac1_directory_structure_exists(self):
        """AC-1: GIVEN das Repository ohne backend/ Verzeichnis
        WHEN der Implementer alle Deliverables erstellt hat
        THEN existiert die Ordnerstruktur: backend/app/, backend/app/services/,
        backend/app/routes/, backend/app/agent/, backend/app/models/
        (jeweils mit __init__.py)
        """
        app_dir = BACKEND_ROOT / "app"
        expected_packages = [
            app_dir,
            app_dir / "services",
            app_dir / "routes",
            app_dir / "agent",
            app_dir / "models",
        ]

        for package_dir in expected_packages:
            assert package_dir.is_dir(), f"Directory missing: {package_dir}"
            init_file = package_dir / "__init__.py"
            assert init_file.is_file(), f"__init__.py missing in: {package_dir}"

    def test_ac2_package_installable(self):
        """AC-2: GIVEN die erstellte backend/pyproject.toml
        WHEN cd backend && pip install -e . ausgefuehrt wird
        THEN laeuft die Installation erfolgreich durch (Exit-Code 0) und alle
        Dependencies sind installiert: fastapi, langgraph, langchain-openai,
        langgraph-checkpoint-postgres, sse-starlette, pydantic-settings,
        psycopg, Pillow, langsmith, uvicorn
        """
        # Verify pip install -e . succeeds (dry-run check via pip show)
        # The package should already be installed in the test environment.
        # We verify all required dependencies are importable.
        required_packages = [
            ("fastapi", "fastapi"),
            ("uvicorn", "uvicorn"),
            ("langgraph", "langgraph"),
            ("langchain_openai", "langchain-openai"),
            ("langgraph.checkpoint.postgres", "langgraph-checkpoint-postgres"),
            ("sse_starlette", "sse-starlette"),
            ("pydantic_settings", "pydantic-settings"),
            ("psycopg", "psycopg"),
            ("PIL", "Pillow"),
            ("langsmith", "langsmith"),
        ]

        for module_name, package_name in required_packages:
            try:
                importlib.import_module(module_name)
            except ImportError:
                pytest.fail(
                    f"Required dependency '{package_name}' (module: {module_name}) "
                    f"is not installed. Run: cd backend && pip install -e ."
                )

    def test_ac2_pyproject_declares_all_dependencies(self):
        """AC-2 (supplementary): pyproject.toml lists all required dependencies."""
        import tomllib

        pyproject_path = BACKEND_ROOT / "pyproject.toml"
        with open(pyproject_path, "rb") as f:
            data = tomllib.load(f)

        dependencies = data.get("project", {}).get("dependencies", [])
        deps_lower = " ".join(dependencies).lower()

        required_deps = [
            "fastapi",
            "langgraph",
            "langchain-openai",
            "langgraph-checkpoint-postgres",
            "sse-starlette",
            "pydantic-settings",
            "psycopg",
            "pillow",
            "langsmith",
            "uvicorn",
        ]

        for dep in required_deps:
            assert dep.lower() in deps_lower, (
                f"Required dependency '{dep}' not found in pyproject.toml dependencies"
            )

    def test_ac3_settings_importable(self):
        """AC-3: GIVEN die installierte app Package
        WHEN python -c 'from app.config import settings' ausgefuehrt wird
        THEN importiert das Modul ohne Fehler und settings ist eine Instanz
        der Settings-Klasse (pydantic-settings BaseSettings)
        """
        from pydantic_settings import BaseSettings

        from app.config import settings

        assert isinstance(settings, BaseSettings), (
            f"settings should be an instance of BaseSettings, "
            f"got {type(settings).__name__}"
        )

    def test_ac4_settings_fields_present(self):
        """AC-4: GIVEN die backend/app/config.py mit pydantic-settings
        WHEN die Settings-Klasse inspiziert wird
        THEN enthaelt sie mindestens folgende Felder:
        database_url (str), openrouter_api_key (str),
        replicate_api_token (str, default ''),
        langsmith_api_key (str, default ''),
        langsmith_tracing (bool, default False),
        assistant_model_default (str, default 'anthropic/claude-sonnet-4.6'),
        app_version (str, default '1.0.0')
        """
        from app.config import Settings

        fields = Settings.model_fields

        # Check all required fields exist
        expected_fields = [
            "database_url",
            "openrouter_api_key",
            "replicate_api_token",
            "langsmith_api_key",
            "langsmith_tracing",
            "assistant_model_default",
            "app_version",
        ]
        for field_name in expected_fields:
            assert field_name in fields, f"Field '{field_name}' missing from Settings"

        # Check field types via annotation
        assert fields["database_url"].annotation is str
        assert fields["openrouter_api_key"].annotation is str
        assert fields["replicate_api_token"].annotation is str
        assert fields["langsmith_api_key"].annotation is str
        assert fields["langsmith_tracing"].annotation is bool
        assert fields["assistant_model_default"].annotation is str
        assert fields["app_version"].annotation is str

        # Check defaults for fields that require them
        assert fields["replicate_api_token"].default == ""
        assert fields["langsmith_api_key"].default == ""
        assert fields["langsmith_tracing"].default is False
        assert fields["assistant_model_default"].default == "anthropic/claude-sonnet-4.6"
        assert fields["app_version"].default == "1.0.0"

    def test_ac5_env_example_contains_all_vars(self):
        """AC-5: GIVEN die erstellte backend/.env.example
        WHEN ein Entwickler die Datei liest
        THEN enthaelt sie alle benoetigten Environment-Variablen als
        kommentierte Beispiele (passend zu den Settings-Feldern)
        """
        env_example_path = BACKEND_ROOT / ".env.example"
        assert env_example_path.is_file(), ".env.example does not exist"

        content = env_example_path.read_text(encoding="utf-8")

        # All env vars that correspond to Settings fields
        required_env_vars = [
            "DATABASE_URL",
            "OPENROUTER_API_KEY",
            "REPLICATE_API_TOKEN",
            "LANGSMITH_API_KEY",
            "LANGSMITH_TRACING",
            "ASSISTANT_MODEL_DEFAULT",
            "APP_VERSION",
        ]

        for var in required_env_vars:
            assert var in content, (
                f"Environment variable '{var}' not found in .env.example"
            )

    def test_ac6_pyproject_metadata(self):
        """AC-6: GIVEN die backend/pyproject.toml
        WHEN die Projekt-Metadaten inspiziert werden
        THEN ist name = 'aifactory-backend', python_requires >= '3.11'
        und das Projekt nutzt ein modernes Build-System
        (hatchling oder setuptools mit pyproject.toml)
        """
        pyproject_path = BACKEND_ROOT / "pyproject.toml"
        assert pyproject_path.is_file(), "pyproject.toml does not exist"

        # Use tomllib (Python 3.11+) to parse the toml file
        import tomllib

        with open(pyproject_path, "rb") as f:
            data = tomllib.load(f)

        # Check project name
        project = data.get("project", {})
        assert project.get("name") == "aifactory-backend", (
            f"Project name should be 'aifactory-backend', got '{project.get('name')}'"
        )

        # Check python_requires >= 3.11
        requires_python = project.get("requires-python", "")
        assert "3.11" in requires_python, (
            f"requires-python should reference 3.11, got '{requires_python}'"
        )
        assert ">=" in requires_python, (
            f"requires-python should use >= operator, got '{requires_python}'"
        )

        # Check build-system uses hatchling or setuptools
        build_system = data.get("build-system", {})
        build_backend = build_system.get("build-backend", "")
        requires = build_system.get("requires", [])

        valid_backends = ["hatchling.backends", "setuptools.build_meta"]
        assert build_backend in valid_backends, (
            f"Build backend should be one of {valid_backends}, got '{build_backend}'"
        )

        # Verify the build-system requires the corresponding package
        requires_str = " ".join(requires)
        assert "hatchling" in requires_str or "setuptools" in requires_str, (
            f"build-system.requires should include hatchling or setuptools, "
            f"got {requires}"
        )
