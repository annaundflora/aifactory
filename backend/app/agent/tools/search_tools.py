"""LangGraph tool for web search via Tavily API."""

import logging

from langchain_core.tools import tool

from app.config import settings

logger = logging.getLogger(__name__)


@tool
async def web_search(query: str, max_results: int = 5) -> dict:
    """Search the web for visual information relevant to image prompt creation.

    Use for: artistic styles, art movements, artists, locations, subjects,
    current trends in photography or design.

    Args:
        query: Focused English search query (e.g. "Baroque painting visual characteristics")
        max_results: Number of results (1-10, default 5)

    Returns:
        Dict with 'answer' (str) and 'results' (list of title/url/content dicts).
        On error or missing key: dict with 'error' key.
    """
    if not settings.tavily_api_key:
        logger.warning("web_search called but TAVILY_API_KEY is not configured")
        return {"error": "Web-Suche nicht verfuegbar: TAVILY_API_KEY ist nicht konfiguriert."}

    try:
        from tavily import AsyncTavilyClient  # lazy import

        max_results = max(1, min(int(max_results), 10))
        client = AsyncTavilyClient(api_key=settings.tavily_api_key)
        response = await client.search(
            query=query,
            max_results=max_results,
            include_answer=True,
            search_depth="basic",
        )
        results = [
            {"title": r.get("title", ""), "url": r.get("url", ""), "content": r.get("content", "")}
            for r in response.get("results") or []
        ]
        logger.info("web_search: query=%r returned %d results", query[:80], len(results))
        return {"answer": response.get("answer") or "", "results": results}

    except Exception as e:
        logger.error("web_search error for query %r: %s", query[:80], e)
        return {"error": f"Web-Suche fehlgeschlagen: {e}"}
