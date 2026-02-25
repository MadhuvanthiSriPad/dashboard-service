"""Tests for the dashboard service."""

import pytest
import httpx
from unittest.mock import AsyncMock, patch, MagicMock

from httpx import ASGITransport, AsyncClient

from src.main import app


MOCK_SESSIONS = [
    {
        "session_id": "sess-001",
        "team_id": "team-1",
        "agent_name": "code-review-bot",
        "model": "gpt-4o",
        "status": "completed",
        "priority": "high",
        "usage": {"input_tokens": 10000, "output_tokens": 5420, "cache_read_tokens": 0},
        "billing": {"total_usd": 0.0231},
        "started_at": "2026-02-20T10:00:00+00:00",
        "ended_at": "2026-02-20T10:00:04+00:00",
        "duration_seconds": 4.5,
        "error_message": None,
        "tags": None,
    },
    {
        "session_id": "sess-002",
        "team_id": "team-2",
        "agent_name": "deploy-agent",
        "model": "gpt-4o",
        "status": "running",
        "priority": "medium",
        "usage": {"input_tokens": 5000, "output_tokens": 3200, "cache_read_tokens": 0},
        "billing": {"total_usd": 0.0164},
        "started_at": "2026-02-20T11:00:00+00:00",
        "ended_at": None,
        "duration_seconds": 2.1,
        "error_message": None,
        "tags": None,
    },
    {
        "session_id": "sess-003",
        "team_id": "team-1",
        "agent_name": "test-writer",
        "model": "gpt-4o",
        "status": "failed",
        "priority": "low",
        "usage": {"input_tokens": 2000, "output_tokens": 1100, "cache_read_tokens": 0},
        "billing": {"total_usd": 0.0047},
        "started_at": "2026-02-20T12:00:00+00:00",
        "ended_at": "2026-02-20T12:00:01+00:00",
        "duration_seconds": 1.2,
        "error_message": "Test generation failed",
        "tags": None,
    },
]

MOCK_COST_BY_TEAM = [
    {"team_id": "team-1", "sessions": 340, "total_cost": 124.56, "total_tokens": 50000},
    {"team_id": "team-2", "sessions": 210, "total_cost": 89.23, "total_tokens": 30000},
    {"team_id": "team-3", "sessions": 150, "total_cost": 67.89, "total_tokens": 20000},
]

MOCK_BILLING_SUMMARY = {
    "total_cost": 281.68,
    "period": "2026-02",
}

MOCK_TEAMS = [
    {"id": "team-1", "name": "platform", "plan": "enterprise", "monthly_budget": 500.0, "created_at": "2026-01-01T00:00:00+00:00", "session_count": 340, "total_cost": 124.56},
    {"id": "team-2", "name": "infra", "plan": "pro", "monthly_budget": 300.0, "created_at": "2026-01-01T00:00:00+00:00", "session_count": 210, "total_cost": 89.23},
    {"id": "team-3", "name": "ml", "plan": "pro", "monthly_budget": 400.0, "created_at": "2026-01-01T00:00:00+00:00", "session_count": 150, "total_cost": 67.89},
]


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
        if "/api/v1/sessions" in url and "sess-" not in url and "/stats" not in url:
            return _mock_response(MOCK_SESSIONS)
        if "/api/v1/analytics/cost-by-team" in url:
            return _mock_response(MOCK_COST_BY_TEAM)
        if "/api/v1/billing/summary" in url:
            return _mock_response(MOCK_BILLING_SUMMARY)
        if "/api/v1/teams" in url:
            return _mock_response(MOCK_TEAMS)
        if "/api/v1/sessions/sess-001" in url:
            return _mock_response(MOCK_SESSIONS[0])
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
    assert stats["active_sessions"] == 1  # 1 running
    assert stats["completed"] == 1
    assert stats["failed"] == 1
    assert stats["success_rate"] == pytest.approx(33.3, abs=0.1)
    assert stats["total_cost"] == 281.68  # from billing summary

    assert len(data["cost_by_team"]) == 3
    assert len(data["recent_sessions"]) == 3
    # Verify sessions were transformed properly
    session = data["recent_sessions"][0]
    assert "id" in session
    assert "agent" in session
    assert "total_tokens" in session


@pytest.mark.asyncio
async def test_sessions(transport, mock_client):
    app.state.http_client = mock_client
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/sessions")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["sessions"]) == 3
    # Verify sessions were transformed from gateway format to frontend format
    session = data["sessions"][0]
    assert session["id"] == "sess-001"
    assert session["agent"] == "code-review-bot"
    assert session["total_tokens"] == 15420  # 10000 + 5420


@pytest.mark.asyncio
async def test_session_detail(transport, mock_client):
    app.state.http_client = mock_client
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/sessions/sess-001")
    assert resp.status_code == 200
    data = resp.json()
    # Session detail proxies raw gateway response (not transformed)
    assert data["session_id"] == "sess-001"
    assert data["agent_name"] == "code-review-bot"
    assert data["usage"]["input_tokens"] == 10000


@pytest.mark.asyncio
async def test_teams(transport, mock_client):
    app.state.http_client = mock_client
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/teams")
    assert resp.status_code == 200
    data = resp.json()
    # api-core returns teams as a flat list
    assert len(data) == 3
    assert data[0]["id"] == "team-1"


@pytest.mark.asyncio
async def test_cost_by_team(transport, mock_client):
    app.state.http_client = mock_client
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/analytics/cost-by-team")
    assert resp.status_code == 200
    data = resp.json()
    # api-core returns cost-by-team as a flat list
    assert len(data) == 3
    assert data[0]["team_id"] == "team-1"


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
