"""Tests for the dashboard service."""

import pytest
import httpx
from unittest.mock import AsyncMock, patch, MagicMock

from httpx import ASGITransport, AsyncClient

from src.main import app


MOCK_SESSIONS = {
    "sessions": [
        {
            "id": "sess-001",
            "agent": "code-review-bot",
            "model": "gpt-4o",
            "team": "platform",
            "status": "completed",
            "total_tokens": 15420,
            "cost": 0.0231,
            "duration_ms": 4500,
        },
        {
            "id": "sess-002",
            "agent": "deploy-agent",
            "model": "gpt-4o",
            "team": "infra",
            "status": "running",
            "total_tokens": 8200,
            "cost": 0.0164,
            "duration_ms": 2100,
        },
        {
            "id": "sess-003",
            "agent": "test-writer",
            "model": "gpt-4o",
            "team": "platform",
            "status": "failed",
            "total_tokens": 3100,
            "cost": 0.0047,
            "duration_ms": 1200,
        },
    ],
    "total": 3,
}

MOCK_COST_BY_TEAM = {
    "teams": [
        {"team": "platform", "total_cost": 124.56, "session_count": 340},
        {"team": "infra", "total_cost": 89.23, "session_count": 210},
        {"team": "ml", "total_cost": 67.89, "session_count": 150},
    ]
}

MOCK_BILLING_SUMMARY = {
    "total_cost": 281.68,
    "period": "2026-02",
}

MOCK_TEAMS = {
    "teams": [
        {"id": "team-1", "name": "platform", "budget": 500.0},
        {"id": "team-2", "name": "infra", "budget": 300.0},
        {"id": "team-3", "name": "ml", "budget": 400.0},
    ]
}


def _mock_response(data: dict, status_code: int = 200) -> httpx.Response:
    """Create a mock httpx response."""
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    resp.json.return_value = data
    resp.raise_for_status = MagicMock()
    if status_code >= 400:
        resp.text = str(data)
        resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "error", request=MagicMock(), response=resp
        )
    return resp


@pytest.fixture
def mock_client():
    """Create a mock httpx client that returns canned responses."""
    client = AsyncMock(spec=httpx.AsyncClient)

    async def mock_get(url: str, **kwargs):
        if "/api/v1/sessions" in url and "sess-" not in url:
            return _mock_response(MOCK_SESSIONS)
        if "/api/v1/analytics/cost-by-team" in url:
            return _mock_response(MOCK_COST_BY_TEAM)
        if "/api/v1/billing/summary" in url:
            return _mock_response(MOCK_BILLING_SUMMARY)
        if "/api/v1/teams" in url:
            return _mock_response(MOCK_TEAMS)
        if "/api/v1/sessions/sess-001" in url:
            return _mock_response(MOCK_SESSIONS["sessions"][0])
        return _mock_response({"detail": "Not found"}, 404)

    client.get = AsyncMock(side_effect=mock_get)
    return client


@pytest.fixture
def transport():
    return ASGITransport(app=app)


@pytest.mark.asyncio
async def test_health(transport):
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["service"] == "dashboard-service"


@pytest.mark.asyncio
async def test_dashboard(transport, mock_client):
    app.state.http_client = mock_client
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/dashboard")
    assert resp.status_code == 200
    data = resp.json()

    stats = data["stats"]
    assert stats["total_sessions"] == 3
    assert stats["active_sessions"] == 1
    assert stats["completed"] == 1
    assert stats["failed"] == 1
    assert stats["success_rate"] == pytest.approx(33.3, abs=0.1)
    assert stats["total_cost"] == 281.68

    assert len(data["cost_by_team"]) == 3
    assert len(data["recent_sessions"]) == 3


@pytest.mark.asyncio
async def test_sessions(transport, mock_client):
    app.state.http_client = mock_client
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/sessions")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3
    assert len(data["sessions"]) == 3


@pytest.mark.asyncio
async def test_session_detail(transport, mock_client):
    app.state.http_client = mock_client
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/sessions/sess-001")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "sess-001"
    assert data["agent"] == "code-review-bot"


@pytest.mark.asyncio
async def test_teams(transport, mock_client):
    app.state.http_client = mock_client
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/teams")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["teams"]) == 3


@pytest.mark.asyncio
async def test_cost_by_team(transport, mock_client):
    app.state.http_client = mock_client
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/analytics/cost-by-team")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["teams"]) == 3


@pytest.mark.asyncio
async def test_dashboard_with_upstream_failure(transport):
    """Dashboard should return defaults when upstream services are down."""
    failing_client = AsyncMock(spec=httpx.AsyncClient)
    failing_client.get = AsyncMock(side_effect=httpx.ConnectError("Connection refused"))
    app.state.http_client = failing_client

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/dashboard")
    assert resp.status_code == 200
    data = resp.json()
    assert data["stats"]["total_sessions"] == 0
    assert data["stats"]["active_sessions"] == 0
    assert data["cost_by_team"] == []
