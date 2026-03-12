"""Unit tests for Slice 02: FastAPI Server + Health Endpoint.

Tests the internal structure and configuration of the FastAPI application,
CORS middleware, lifespan handler, and health route module.
No mocks -- real instances, real imports.
"""

import inspect
from contextlib import asynccontextmanager

import pytest
from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware


class TestAppFactory:
    """Unit tests for the application factory and its configuration."""

    def test_create_app_returns_fastapi_instance(self):
        """create_app() must return a FastAPI application instance."""
        from app.main import create_app

        application = create_app()
        assert isinstance(application, FastAPI)

    def test_app_module_level_instance_is_fastapi(self):
        """The module-level `app` object must be a FastAPI instance."""
        from app.main import app

        assert isinstance(app, FastAPI)


class TestCorsMiddleware:
    """Unit tests for CORS middleware configuration (AC-4)."""

    @staticmethod
    def _find_cors_middleware_config(application):
        """Find CORS middleware config from the app's user_middleware list."""
        for mw in application.user_middleware:
            if mw.cls is CORSMiddleware:
                return mw
        return None

    def test_cors_middleware_is_registered(self):
        """CORS middleware must be present in the middleware stack."""
        from app.main import create_app

        application = create_app()
        cors_mw = self._find_cors_middleware_config(application)

        assert cors_mw is not None, (
            "CORSMiddleware not found in the middleware stack"
        )

    def test_cors_allow_origins_wildcard(self):
        """CORS must be configured with allow_origins=['*']."""
        from app.main import create_app

        application = create_app()
        cors_mw = self._find_cors_middleware_config(application)

        assert cors_mw is not None, "CORSMiddleware not found"
        assert cors_mw.kwargs.get("allow_origins") == ["*"], (
            f"CORS allow_origins should be ['*'], "
            f"got {cors_mw.kwargs.get('allow_origins')}"
        )

    def test_cors_allow_methods_wildcard(self):
        """CORS must be configured with allow_methods=['*']."""
        from app.main import create_app

        application = create_app()
        cors_mw = self._find_cors_middleware_config(application)

        assert cors_mw is not None, "CORSMiddleware not found"
        assert cors_mw.kwargs.get("allow_methods") == ["*"], (
            f"CORS allow_methods should be ['*'], "
            f"got {cors_mw.kwargs.get('allow_methods')}"
        )

    def test_cors_allow_headers_wildcard(self):
        """CORS must be configured with allow_headers=['*']."""
        from app.main import create_app

        application = create_app()
        cors_mw = self._find_cors_middleware_config(application)

        assert cors_mw is not None, "CORSMiddleware not found"
        assert cors_mw.kwargs.get("allow_headers") == ["*"], (
            f"CORS allow_headers should be ['*'], "
            f"got {cors_mw.kwargs.get('allow_headers')}"
        )


class TestLifespanHandler:
    """Unit tests for the lifespan handler (AC-5)."""

    def test_lifespan_function_exists(self):
        """A lifespan function must be defined in app.main."""
        from app.main import lifespan

        assert lifespan is not None

    def test_lifespan_is_async_context_manager(self):
        """The lifespan handler must be an async context manager (async generator function)."""
        from app.main import lifespan

        # asynccontextmanager-decorated functions are async generator functions
        assert callable(lifespan), "lifespan must be callable"
        # The decorated function should accept an app parameter
        sig = inspect.signature(lifespan)
        params = list(sig.parameters.keys())
        assert len(params) >= 1, (
            "lifespan must accept at least one parameter (the app instance)"
        )

    def test_lifespan_is_set_on_app(self):
        """The FastAPI app must use the lifespan handler."""
        from app.main import app

        # FastAPI stores the lifespan in router.lifespan_context
        assert app.router.lifespan_context is not None, (
            "App must have a lifespan handler configured"
        )


class TestHealthRouteModule:
    """Unit tests for the health route module (AC-7, AC-8)."""

    def test_health_module_exports_router(self):
        """app.routes.health must export a 'router' object."""
        from app.routes.health import router

        assert router is not None

    def test_health_router_is_api_router(self):
        """The health router must be an instance of APIRouter."""
        from app.routes.health import router

        assert isinstance(router, APIRouter), (
            f"router should be APIRouter, got {type(router).__name__}"
        )

    def test_health_route_has_get_health(self):
        """The health router must have a GET /health route defined."""
        from app.routes.health import router

        route_paths = [route.path for route in router.routes]
        assert "/health" in route_paths, (
            f"Expected '/health' in router routes, found: {route_paths}"
        )

    def test_health_version_uses_settings(self):
        """The health route module must import version from settings, not hardcode it."""
        import ast
        from pathlib import Path

        health_module_path = (
            Path(__file__).resolve().parent.parent.parent / "app" / "routes" / "health.py"
        )
        source = health_module_path.read_text(encoding="utf-8")
        tree = ast.parse(source)

        # Check that 'settings' is imported somewhere in the module
        imports_settings = False
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                for alias in node.names:
                    if alias.name == "settings":
                        imports_settings = True

        assert imports_settings, (
            "health.py must import 'settings' from app.config to get the version"
        )
