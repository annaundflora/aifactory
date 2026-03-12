"""Acceptance tests for Slice 02: FastAPI Server + Health Endpoint.

Tests are derived 1:1 from the GIVEN/WHEN/THEN Acceptance Criteria
in specs/phase-3/2026-03-11-prompt-assistant/slices/slice-02-fastapi-server-health.md.

Mocking Strategy: no_mocks (as specified in Slice-Spec).
"""

import inspect

import pytest
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient
from starlette.middleware.cors import CORSMiddleware


@pytest.fixture()
def client():
    """Create a real TestClient against the actual FastAPI application."""
    from app.main import app

    with TestClient(app) as c:
        yield c


class TestSlice02Acceptance:
    """Acceptance tests for Slice 02 - FastAPI Server + Health Endpoint."""

    def test_ac1_server_starts_without_error(self):
        """AC-1: GIVEN die installierte app Package aus Slice 01
        WHEN uvicorn app.main:app --host 0.0.0.0 --port 8000 ausgefuehrt wird
        THEN startet der Server ohne Fehler und loggt 'Uvicorn running on http://0.0.0.0:8000'

        We verify this by creating the FastAPI app instance and a TestClient
        without errors, which proves the app can be loaded by uvicorn.
        """
        from app.main import app

        assert isinstance(app, FastAPI), (
            "app must be a FastAPI instance that uvicorn can serve"
        )

        # Verify the app can be used by a TestClient (simulates uvicorn serving it)
        with TestClient(app) as test_client:
            # If we get here without error, the app starts successfully
            assert test_client is not None

    def test_ac2_health_endpoint_returns_ok(self, client):
        """AC-2: GIVEN der laufende FastAPI Server
        WHEN GET /api/assistant/health aufgerufen wird
        THEN antwortet der Server mit HTTP 200 und JSON-Body
        {"status": "ok", "version": "1.0.0"}
        """
        response = client.get("/api/assistant/health")

        assert response.status_code == 200, (
            f"Expected HTTP 200, got {response.status_code}"
        )

        data = response.json()
        assert data == {"status": "ok", "version": "1.0.0"}, (
            f"Expected {{'status': 'ok', 'version': '1.0.0'}}, got {data}"
        )

    def test_ac3_health_endpoint_content_type_json(self, client):
        """AC-3: GIVEN der laufende FastAPI Server
        WHEN GET /api/assistant/health aufgerufen wird mit Header Accept: application/json
        THEN enthaelt der Response-Header content-type: application/json
        """
        response = client.get(
            "/api/assistant/health",
            headers={"Accept": "application/json"},
        )

        content_type = response.headers.get("content-type", "")
        assert "application/json" in content_type, (
            f"Expected 'application/json' in content-type header, "
            f"got '{content_type}'"
        )

    def test_ac4_cors_middleware_configured(self):
        """AC-4: GIVEN die FastAPI Application in backend/app/main.py
        WHEN die App-Instanz inspiziert wird
        THEN ist CORS-Middleware konfiguriert mit allow_origins=['*'],
        allow_methods=['*'], allow_headers=['*']
        """
        from app.main import app

        # Find CORS middleware in the registered user_middleware list
        cors_mw = None
        for mw in app.user_middleware:
            if mw.cls is CORSMiddleware:
                cors_mw = mw
                break

        assert cors_mw is not None, (
            "CORSMiddleware must be configured on the FastAPI application"
        )

        # Verify allow_origins=["*"]
        assert cors_mw.kwargs.get("allow_origins") == ["*"], (
            f"CORS must have allow_origins=['*'], "
            f"got {cors_mw.kwargs.get('allow_origins')}"
        )

        # Verify allow_methods=["*"]
        assert cors_mw.kwargs.get("allow_methods") == ["*"], (
            f"CORS must have allow_methods=['*'], "
            f"got {cors_mw.kwargs.get('allow_methods')}"
        )

        # Verify allow_headers=["*"]
        assert cors_mw.kwargs.get("allow_headers") == ["*"], (
            f"CORS must have allow_headers=['*'], "
            f"got {cors_mw.kwargs.get('allow_headers')}"
        )

        # Also verify via actual HTTP preflight that CORS works
        with TestClient(app) as test_client:
            response = test_client.options(
                "/api/assistant/health",
                headers={
                    "Origin": "http://example.com",
                    "Access-Control-Request-Method": "DELETE",
                    "Access-Control-Request-Headers": "X-Custom-Header",
                },
            )
            # allow_methods=["*"] means any method is allowed
            allow_methods = response.headers.get("access-control-allow-methods", "")
            assert "DELETE" in allow_methods, (
                f"CORS should allow any method (allow_methods=['*']), "
                f"but DELETE not in '{allow_methods}'"
            )

            # allow_headers=["*"] means any header is allowed
            allow_headers = response.headers.get("access-control-allow-headers", "")
            assert "X-Custom-Header" in allow_headers, (
                f"CORS should allow any header (allow_headers=['*']), "
                f"but X-Custom-Header not in '{allow_headers}'"
            )

    def test_ac5_lifespan_handler_exists(self):
        """AC-5: GIVEN die FastAPI Application in backend/app/main.py
        WHEN die App-Instanz inspiziert wird
        THEN existiert ein Lifespan-Handler (async context manager) der als
        Platzhalter fuer spaetere DB-Connection dient
        """
        from app.main import app, lifespan

        # Verify lifespan function exists and is callable
        assert callable(lifespan), "lifespan must be a callable"

        # Verify the app has a lifespan context configured
        assert app.router.lifespan_context is not None, (
            "FastAPI app must have a lifespan handler configured "
            "(via lifespan parameter in FastAPI constructor)"
        )

    def test_ac6_unknown_route_returns_404(self, client):
        """AC-6: GIVEN der laufende FastAPI Server
        WHEN GET /nonexistent-route aufgerufen wird
        THEN antwortet der Server mit HTTP 404 (nicht 500)
        """
        response = client.get("/nonexistent-route")

        assert response.status_code == 404, (
            f"Expected HTTP 404 for unknown route, got {response.status_code}"
        )
        # Explicitly verify it is NOT a 500
        assert response.status_code != 500, (
            "Unknown route must return 404, not 500 (server error)"
        )

    def test_ac7_health_route_uses_api_router(self):
        """AC-7: GIVEN die Health-Route in backend/app/routes/health.py
        WHEN das Modul inspiziert wird
        THEN ist die Route als APIRouter definiert und in main.py via
        include_router eingebunden, mit Prefix /api/assistant
        """
        from app.routes.health import router

        # Verify it is an APIRouter
        assert isinstance(router, APIRouter), (
            f"Health router must be an APIRouter, got {type(router).__name__}"
        )

        # Verify the router is included in the main app with correct prefix
        from app.main import app

        route_paths = [route.path for route in app.routes]
        assert "/api/assistant/health" in route_paths, (
            f"Health route must be registered at /api/assistant/health via "
            f"include_router with prefix='/api/assistant'. "
            f"Found routes: {route_paths}"
        )

    def test_ac8_health_version_from_settings(self, client):
        """AC-8: GIVEN die backend/app/main.py
        WHEN die Version im Health-Response inspiziert wird
        THEN stammt der Wert '1.0.0' aus settings.app_version
        (nicht hardcoded in der Route)
        """
        from app.config import settings

        response = client.get("/api/assistant/health")
        data = response.json()

        # The version in the response must match settings.app_version
        assert data["version"] == settings.app_version, (
            f"Health version '{data['version']}' must come from "
            f"settings.app_version ('{settings.app_version}'), not be hardcoded"
        )

        # Additionally verify that the health module imports settings
        # (structural check that it's not hardcoded)
        import ast
        from pathlib import Path

        health_path = (
            Path(__file__).resolve().parent.parent.parent / "app" / "routes" / "health.py"
        )
        source = health_path.read_text(encoding="utf-8")
        tree = ast.parse(source)

        imports_settings = False
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                for alias in node.names:
                    if alias.name == "settings":
                        imports_settings = True

        assert imports_settings, (
            "health.py must import 'settings' to get app_version dynamically"
        )

        # Verify the string "1.0.0" is NOT hardcoded in the response dict
        # by checking that no return statement contains a literal "1.0.0"
        has_hardcoded_version = False
        for node in ast.walk(tree):
            if isinstance(node, ast.Return) and node.value:
                # Look for string constants in the return value
                for child in ast.walk(node.value):
                    if isinstance(child, ast.Constant) and child.value == "1.0.0":
                        has_hardcoded_version = True

        assert not has_hardcoded_version, (
            "health.py must NOT hardcode '1.0.0' in the return statement -- "
            "it should use settings.app_version"
        )
