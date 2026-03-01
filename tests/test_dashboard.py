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
        "compliance_level": "soc2",
        "data_residency": "us",
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
        "compliance_level": "none",
        "data_residency": "eu",
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
        "compliance_level": "hipaa",
        "data_residency": "ap",
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

MOCK_CONTRACT_CHANGE_DETAIL = {
    "id": 42,
    "severity": "low",
    "summary_json": '{"summary": "Non-breaking changes detected"}',
    "changed_routes_json": '["GET /api/v1/contracts/changes/{change_id}"]',
    "source_repo": "api-core",
    "affected_services": 2,
    "remediation_status": "in_progress",
    "created_at": "2026-02-28T10:00:00+00:00",
    "impact_sets": [
        {
            "caller_service": "dashboard-service",
            "route_template": "/api/v1/contracts/changes/{change_id}",
            "method": "GET",
            "calls_last_7d": 150,
            "confidence": "high",
        },
        {
            "caller_service": "analytics-service",
            "route_template": "/api/v1/contracts/changes/{change_id}",
            "method": None,
            "calls_last_7d": 42,
            "confidence": "medium",
        },
    ],
    "remediation_jobs": [],
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
        if "/api/v1/contracts/changes/" in url:
            return _mock_response(MOCK_CONTRACT_CHANGE_DETAIL)
        if "/api/v1/contracts/changes" in url:
            return _mock_response([MOCK_CONTRACT_CHANGE_DETAIL])
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
    assert "compliance_level" in session
    assert session["compliance_level"] in ("soc2", "none", "hipaa", "fedramp", "")
    assert "data_residency" in session
    assert session["data_residency"] in ("us", "eu", "ap")


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
    assert session["compliance_level"] == "soc2"
    assert session["data_residency"] == "us"


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
async def test_contract_change_detail(transport, mock_client):
    """Contract change detail should proxy the response including the new method field in impact_sets."""
    app.state.http_client = mock_client
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/contracts/changes/42")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == 42
    assert data["severity"] == "low"
    # Verify impact_sets include the new method field
    assert len(data["impact_sets"]) == 2
    assert data["impact_sets"][0]["method"] == "GET"
    assert data["impact_sets"][0]["caller_service"] == "dashboard-service"
    assert data["impact_sets"][0]["calls_last_7d"] == 150
    # Second entry has nullable method
    assert data["impact_sets"][1]["method"] is None
    assert data["impact_sets"][1]["caller_service"] == "analytics-service"


@pytest.mark.asyncio
async def test_contract_changes_list(transport, mock_client):
    """Contract changes list should proxy the response."""
    app.state.http_client = mock_client
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/contracts/changes")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["id"] == 42


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


@pytest.mark.asyncio
async def test_create_session_proxies_with_data_residency(transport, mock_client):
    """POST /api/sessions should forward body including data_residency to api-core."""
    created_session = {
        "session_id": "sess-new",
        "team_id": "team-1",
        "agent_name": "new-agent",
        "model": "gpt-4o",
        "status": "running",
        "priority": "high",
        "compliance_level": "soc2",
        "data_residency": "eu",
        "usage": {"input_tokens": 0, "output_tokens": 0, "cached_tokens": 0},
        "billing": {"total": 0},
        "started_at": "2026-02-20T13:00:00+00:00",
        "ended_at": None,
        "duration_seconds": 0,
        "error_message": None,
        "tags": None,
    }
    mock_client.post = AsyncMock(return_value=_mock_response(created_session))
    app.state.http_client = mock_client

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post(
            "/api/sessions",
            json={
                "team_id": "team-1",
                "agent_name": "new-agent",
                "model": "gpt-4o",
                "priority": "high",
                "compliance_level": "soc2",
                "data_residency": "eu",
            },
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["session_id"] == "sess-new"
    assert data["compliance_level"] == "soc2"
    assert data["data_residency"] == "eu"

    # Verify the POST was forwarded with both required fields in the body
    call_kwargs = mock_client.post.call_args
    forwarded_body = call_kwargs.kwargs.get("json", {})
    assert forwarded_body["compliance_level"] == "soc2"
    assert forwarded_body["data_residency"] == "eu"


@pytest.mark.asyncio
async def test_create_session_defaults_required_fields(transport, mock_client):
    """POST /api/sessions should inject default compliance_level and data_residency when omitted."""
    created_session = {
        "session_id": "sess-new2",
        "team_id": "team-2",
        "agent_name": "deploy-bot",
        "model": "gpt-4o",
        "status": "running",
        "priority": "medium",
        "compliance_level": "none",
        "data_residency": "us",
        "usage": {"input_tokens": 0, "output_tokens": 0, "cached_tokens": 0},
        "billing": {"total": 0},
        "started_at": "2026-02-20T14:00:00+00:00",
        "ended_at": None,
        "duration_seconds": 0,
        "error_message": None,
        "tags": None,
    }
    mock_client.post = AsyncMock(return_value=_mock_response(created_session))
    app.state.http_client = mock_client

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post(
            "/api/sessions",
            json={
                "team_id": "team-2",
                "agent_name": "deploy-bot",
                "model": "gpt-4o",
                "priority": "medium",
            },
        )
    assert resp.status_code == 200

    # Verify both required fields were injected with defaults
    call_kwargs = mock_client.post.call_args
    forwarded_body = call_kwargs.kwargs.get("json", {})
    assert forwarded_body["compliance_level"] == "none"
    assert forwarded_body["data_residency"] == "us"


@pytest.mark.asyncio
async def test_create_session_rejects_invalid_compliance_level(transport, mock_client):
    """POST /api/sessions should reject invalid compliance_level values."""
    app.state.http_client = mock_client

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post(
            "/api/sessions",
            json={
                "team_id": "team-1",
                "agent_name": "bad-agent",
                "compliance_level": "invalid",
                "data_residency": "us",
            },
        )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_session_rejects_invalid_data_residency(transport, mock_client):
    """POST /api/sessions should reject invalid data_residency values."""
    app.state.http_client = mock_client

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post(
            "/api/sessions",
            json={
                "team_id": "team-1",
                "agent_name": "bad-agent",
                "compliance_level": "soc2",
                "data_residency": "invalid",
            },
        )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_live_jobs_sync_preserves_cooldown_payload(transport):
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 429
    mock_resp.json.return_value = {
        "detail": {
            "kind": "sync_cooldown",
            "message": "Sync cooldown: retry in 27s",
            "retry_after_seconds": 27,
        }
    }
    mock_resp.text = '{"detail":{"kind":"sync_cooldown","message":"Sync cooldown: retry in 27s","retry_after_seconds":27}}'
    mock_resp.headers = {"Retry-After": "27"}
    mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
        "cooldown",
        request=MagicMock(),
        response=mock_resp,
    )

    client = AsyncMock(spec=httpx.AsyncClient)
    client.post = AsyncMock(return_value=mock_resp)
    app.state.http_client = client

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/contracts/live-jobs/sync")

    assert resp.status_code == 429
    assert resp.headers["Retry-After"] == "27"
    assert resp.json() == {
        "detail": {
            "kind": "sync_cooldown",
            "message": "Sync cooldown: retry in 27s",
            "retry_after_seconds": 27,
        }
    }
