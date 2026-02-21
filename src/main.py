"""AgentBoard Dashboard Service - FastAPI BFF (Backend for Frontend).

Proxies requests to api-core and billing-service, and serves
the React frontend static build in production.
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.config import settings

logger = logging.getLogger(__name__)

GATEWAY = settings.gateway_url
BILLING = settings.billing_url


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage the httpx async client lifecycle."""
    app.state.http_client = httpx.AsyncClient(
        timeout=30.0,
        headers={"X-Caller-Service": "dashboard-service"},
    )
    yield
    await app.state.http_client.aclose()


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _client(request: Request) -> httpx.AsyncClient:
    return request.app.state.http_client


async def _proxy(client: httpx.AsyncClient, url: str):
    """Proxy a GET request and return JSON, raising HTTPException on failure."""
    try:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.json()
    except httpx.ConnectError:
        logger.warning("Upstream unreachable: %s", url)
        raise HTTPException(status_code=502, detail=f"Upstream unreachable: {url}")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"Upstream error: {exc.response.text}",
        )
    except Exception as exc:
        logger.exception("Proxy error for %s", url)
        raise HTTPException(status_code=500, detail=str(exc))


async def _fetch_team_names(client: httpx.AsyncClient) -> dict[str, dict]:
    """Fetch teams from gateway and return a dict keyed by team_id."""
    try:
        teams = await _proxy(client, f"{GATEWAY}/api/v1/teams")
        if isinstance(teams, list):
            return {
                t["id"]: {"name": t.get("name", t["id"]), "budget": t.get("monthly_budget", 0)}
                for t in teams
            }
    except HTTPException:
        pass
    return {}


def _transform_session(s: dict, team_names: dict[str, dict]) -> dict:
    """Transform a gateway session into the shape the frontend expects."""
    team_id = s.get("team_id", "")
    team_info = team_names.get(team_id, {})
    duration_s = s.get("duration_seconds") or 0
    return {
        "id": s.get("session_id", ""),
        "agent": s.get("agent_name", ""),
        "model": s.get("model", ""),
        "team": team_info.get("name", team_id),
        "status": s.get("status", ""),
        "total_tokens": (s.get("input_tokens", 0) or 0) + (s.get("output_tokens", 0) or 0),
        "cost": s.get("total_cost", 0),
        "duration_ms": int(duration_s * 1000) if duration_s else None,
    }


# ── Health ───────────────────────────────────────────────────────────────────


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "dashboard-service"}


# ── Aggregated dashboard ─────────────────────────────────────────────────────


@app.get("/api/dashboard")
async def dashboard(request: Request):
    """Return aggregated dashboard data combining gateway + billing info."""
    client = _client(request)

    sessions_data = []
    cost_data = []
    billing_data = {}

    try:
        sessions_data = await _proxy(client, f"{GATEWAY}/api/v1/sessions")
    except HTTPException:
        sessions_data = []

    try:
        cost_data = await _proxy(client, f"{GATEWAY}/api/v1/analytics/cost-by-team")
    except HTTPException:
        cost_data = []

    try:
        billing_data = await _proxy(client, f"{BILLING}/api/v1/billing/summary")
    except HTTPException:
        billing_data = {"total_cost": 0}

    # Normalize to lists
    sessions = sessions_data if isinstance(sessions_data, list) else sessions_data.get("sessions", [])
    teams_list = cost_data if isinstance(cost_data, list) else cost_data.get("teams", [])
    if not isinstance(billing_data, dict):
        billing_data = {"total_cost": 0}

    # Fetch team names for mapping team_id -> display name + budget
    team_names = await _fetch_team_names(client)

    total = len(sessions)
    active = sum(1 for s in sessions if s.get("status") == "running")
    completed = sum(1 for s in sessions if s.get("status") == "completed")
    failed = sum(1 for s in sessions if s.get("status") == "failed")
    success_rate = round(completed / total * 100, 1) if total > 0 else 0

    total_cost = billing_data.get("total_cost", 0)
    if not total_cost:
        total_cost = sum(t.get("total_cost", 0) for t in teams_list)

    # Transform cost-by-team: map team_id -> team name, add budget
    cost_by_team = []
    for t in teams_list:
        tid = t.get("team_id", "")
        info = team_names.get(tid, {})
        cost_by_team.append({
            "team": info.get("name", tid),
            "total_cost": t.get("total_cost", 0),
            "session_count": t.get("sessions", 0),
            "budget": info.get("budget", 0),
        })

    # Transform recent sessions
    recent = [_transform_session(s, team_names) for s in sessions[:20]]

    return {
        "stats": {
            "total_sessions": total,
            "active_sessions": active,
            "total_cost": round(total_cost, 4),
            "success_rate": success_rate,
            "completed": completed,
            "failed": failed,
        },
        "cost_by_team": cost_by_team,
        "recent_sessions": recent,
    }


# ── Session proxies ─────────────────────────────────────────────────────────


@app.get("/api/sessions")
async def list_sessions(request: Request):
    client = _client(request)
    raw = await _proxy(client, f"{GATEWAY}/api/v1/sessions")
    sessions = raw if isinstance(raw, list) else raw.get("sessions", [])
    team_names = await _fetch_team_names(client)
    return {"sessions": [_transform_session(s, team_names) for s in sessions]}


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str, request: Request):
    return await _proxy(
        _client(request), f"{GATEWAY}/api/v1/sessions/{session_id}"
    )


# ── Teams ────────────────────────────────────────────────────────────────────


@app.get("/api/teams")
async def list_teams(request: Request):
    return await _proxy(_client(request), f"{GATEWAY}/api/v1/teams")


# ── Analytics proxies ────────────────────────────────────────────────────────


@app.get("/api/analytics/token-usage")
async def token_usage(request: Request):
    daily = await _proxy(
        _client(request), f"{GATEWAY}/api/v1/analytics/token-usage/daily"
    )
    usage = daily if isinstance(daily, list) else []
    return {"usage": usage}


@app.get("/api/analytics/cost-by-team")
async def cost_by_team(request: Request):
    return await _proxy(
        _client(request), f"{GATEWAY}/api/v1/analytics/cost-by-team"
    )


# ── Billing proxies ─────────────────────────────────────────────────────────


@app.get("/api/billing/invoices")
async def billing_invoices(request: Request):
    return await _proxy(
        _client(request), f"{BILLING}/api/v1/invoices"
    )


@app.get("/api/billing/summary")
async def billing_summary(request: Request):
    return await _proxy(
        _client(request), f"{BILLING}/api/v1/billing/summary"
    )


# ── Usage & Contract proxies (propagation engine) ───────────────────────────


@app.get("/api/usage/top-routes")
async def usage_top_routes(request: Request, since_days: int = 7):
    return await _proxy(
        _client(request),
        f"{GATEWAY}/api/v1/usage/top-routes?since_days={since_days}",
    )


@app.get("/api/usage/top-callers")
async def usage_top_callers(request: Request, route: str | None = None, since_days: int = 7):
    url = f"{GATEWAY}/api/v1/usage/top-callers?since_days={since_days}"
    if route:
        url += f"&route={route}"
    return await _proxy(_client(request), url)


@app.get("/api/contracts/current")
async def contracts_current(request: Request):
    return await _proxy(_client(request), f"{GATEWAY}/api/v1/contracts/current")


@app.get("/api/contracts/changes")
async def contracts_changes(request: Request, limit: int = 20):
    return await _proxy(
        _client(request),
        f"{GATEWAY}/api/v1/contracts/changes?limit={limit}",
    )


@app.get("/api/contracts/changes/{change_id}")
async def contracts_change_detail(change_id: int, request: Request):
    return await _proxy(
        _client(request),
        f"{GATEWAY}/api/v1/contracts/changes/{change_id}",
    )


# ── Static file serving (production) ────────────────────────────────────────

static_dir = Path(__file__).resolve().parent.parent / "static"
if static_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
