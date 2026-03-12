"""Integration tests for Slice 02: FastAPI Server + Health Endpoint.

Tests the full HTTP request/response cycle through the real FastAPI
application with real router, middleware, and settings integration.
No mocks -- real TestClient, real app instance, real settings.
"""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client():
    """Create a real TestClient against the actual FastAPI application."""
    from app.main import app

    with TestClient(app) as c:
        yield c


class TestHealthEndpointIntegration:
    """Integration tests for the health endpoint through the full stack."""

    def test_health_endpoint_full_path(self, client):
        """GET /api/assistant/health works through the full router + prefix chain."""
        response = client.get("/api/assistant/health")
        assert response.status_code == 200

    def test_health_response_json_body(self, client):
        """Health endpoint returns the correct JSON structure through the full stack."""
        response = client.get("/api/assistant/health")
        data = response.json()

        assert "status" in data
        assert "version" in data
        assert data["status"] == "ok"
        assert data["version"] == "1.0.0"

    def test_health_content_type_header(self, client):
        """Health endpoint response includes application/json content-type header."""
        response = client.get(
            "/api/assistant/health",
            headers={"Accept": "application/json"},
        )
        content_type = response.headers.get("content-type", "")
        assert "application/json" in content_type

    def test_cors_headers_on_preflight(self, client):
        """CORS preflight request to health endpoint returns correct headers."""
        origin = "http://localhost:3000"
        response = client.options(
            "/api/assistant/health",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "Content-Type",
            },
        )
        allow_origin = response.headers.get("access-control-allow-origin", "")
        # With allow_origins=["*"] + allow_credentials=True, Starlette
        # echoes the requesting origin instead of returning literal "*"
        assert allow_origin in ("*", origin), (
            f"Expected CORS allow-origin to be '*' or '{origin}', got '{allow_origin}'"
        )

    def test_cors_headers_on_get(self, client):
        """CORS headers are included in regular GET response."""
        response = client.get(
            "/api/assistant/health",
            headers={"Origin": "http://localhost:3000"},
        )
        assert response.headers.get("access-control-allow-origin") == "*"


class TestRoutingIntegration:
    """Integration tests for routing behavior through the full app."""

    def test_nonexistent_route_returns_404(self, client):
        """Unknown routes return 404, not 500."""
        response = client.get("/nonexistent-route")
        assert response.status_code == 404

    def test_nonexistent_api_route_returns_404(self, client):
        """Unknown routes under /api/assistant also return 404."""
        response = client.get("/api/assistant/nonexistent")
        assert response.status_code == 404

    def test_health_without_prefix_returns_404(self, client):
        """GET /health (without /api/assistant prefix) returns 404."""
        response = client.get("/health")
        assert response.status_code == 404


class TestSettingsIntegration:
    """Integration tests verifying settings flow through the app to the response."""

    def test_version_in_response_matches_settings(self, client):
        """The version in the health response matches settings.app_version."""
        from app.config import settings

        response = client.get("/api/assistant/health")
        data = response.json()

        assert data["version"] == settings.app_version, (
            f"Health version '{data['version']}' does not match "
            f"settings.app_version '{settings.app_version}'"
        )

    def test_router_included_with_correct_prefix(self):
        """The health router is included in the app with prefix /api/assistant."""
        from app.main import app

        # Check that /api/assistant/health is a registered route
        route_paths = [route.path for route in app.routes]
        assert "/api/assistant/health" in route_paths, (
            f"Expected '/api/assistant/health' in app routes, found: {route_paths}"
        )
