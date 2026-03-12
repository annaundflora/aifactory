"""Integration tests for Slice 01: Python Projekt-Setup.

Tests the integration between pyproject.toml, package structure,
and config module. No mocks -- real imports, real file system.
"""

import importlib
import pathlib
import subprocess
import sys

import pytest

BACKEND_ROOT = pathlib.Path(__file__).resolve().parent.parent.parent


class TestPackageIntegration:
    """Integration tests verifying the full package installs and works together."""

    def test_app_package_importable(self):
        """The app package can be imported as a Python module."""
        import app

        assert app is not None

    def test_app_subpackages_importable(self):
        """All sub-packages (services, routes, agent, models) are importable."""
        subpackages = [
            "app.services",
            "app.routes",
            "app.agent",
            "app.models",
        ]
        for pkg in subpackages:
            mod = importlib.import_module(pkg)
            assert mod is not None, f"Failed to import {pkg}"

    def test_settings_singleton_is_consistent(self):
        """The module-level settings instance is the same object on re-import."""
        from app.config import settings as s1

        # Re-import to verify it is a module-level singleton
        mod = importlib.import_module("app.config")
        s2 = mod.settings

        assert s1 is s2, "settings should be the same module-level instance"

    def test_pyproject_dependencies_match_installed(self):
        """All dependencies listed in pyproject.toml are actually installed."""
        import tomllib

        pyproject_path = BACKEND_ROOT / "pyproject.toml"
        with open(pyproject_path, "rb") as f:
            data = tomllib.load(f)

        dependencies = data.get("project", {}).get("dependencies", [])
        assert len(dependencies) > 0, "No dependencies found in pyproject.toml"

        # Extract package names (before any version specifier)
        for dep_str in dependencies:
            # Handle entries like "psycopg[binary]>=3.3.3"
            pkg_name = dep_str.split(">=")[0].split("<=")[0].split("==")[0].split("[")[0].strip()
            # pip normalizes names: underscores become hyphens
            result = subprocess.run(
                [sys.executable, "-m", "pip", "show", pkg_name],
                capture_output=True,
                text=True,
                timeout=30,
            )
            assert result.returncode == 0, (
                f"Dependency '{pkg_name}' from pyproject.toml is not installed. "
                f"stderr: {result.stderr}"
            )

    def test_env_example_matches_settings_fields(self):
        """Every Settings field has a corresponding env var in .env.example."""
        from app.config import Settings

        env_example_path = BACKEND_ROOT / ".env.example"
        content = env_example_path.read_text(encoding="utf-8")

        for field_name in Settings.model_fields:
            env_var_name = field_name.upper()
            assert env_var_name in content, (
                f"Settings field '{field_name}' has no matching env var "
                f"'{env_var_name}' in .env.example"
            )
