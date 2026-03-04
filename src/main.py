"""Dashboard Service — FastAPI BFF (Backend for Frontend).

Proxies requests to api-core and billing-service, and serves
the React frontend static build in production.
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import quote

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
    headers = {"X-Caller-Service": settings.service_name}
    if settings.api_core_api_key:
        headers["X-API-Key"] = settings.api_core_api_key
    app.state.http_client = httpx.AsyncClient(
        timeout=30.0,
        headers=headers,
    )
    yield
    await app.state.http_client.aclose()


app = FastAPI(
    title=settings.app_name,
    version=settings.api_version,
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
    usage = s.get("usage", {})
    billing = s.get("billing", {})
    cached_tokens = usage.get("cache_read_tokens", usage.get("cached_tokens", 0)) or 0
    total_cost = billing.get("total_usd", billing.get("total", 0))
    return {
        "id": s.get("session_id", ""),
        "agent": s.get("agent_name", ""),
        "model": s.get("model", ""),
        "team": team_info.get("name", team_id),
        "status": s.get("status", ""),
        "total_tokens": (usage.get("input_tokens", 0) or 0) + (usage.get("output_tokens", 0) or 0) + cached_tokens,
        "cost": total_cost,
        "duration_ms": int(duration_s * 1000) if duration_s else None,
    }


# ── Health ───────────────────────────────────────────────────────────────────


@app.get("/health")
async def health():
    return {"status": "healthy", "service": settings.service_name}


# ── Aggregated dashboard ─────────────────────────────────────────────────────


@app.get("/api/dashboard")
async def dashboard(request: Request):
    """Return aggregated dashboard data combining gateway + billing info."""
    client = _client(request)

    sessions_data = []
    cost_data = []
    billing_data = {}

    try:
        sessions_data = await _proxy(client, f"{GATEWAY}/api/v1/sessions?max_cost_usd={settings.default_max_cost_usd}")
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
            "session_count": t.get("total_sessions", t.get("sessions", 0)),
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
    raw = await _proxy(client, f"{GATEWAY}/api/v1/sessions?max_cost_usd={settings.default_max_cost_usd}")
    sessions = raw if isinstance(raw, list) else raw.get("sessions", [])
    team_names = await _fetch_team_names(client)
    return {"sessions": [_transform_session(s, team_names) for s in sessions]}


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str, request: Request):
    return await _proxy(
        _client(request), f"{GATEWAY}/api/v1/sessions/{session_id}?max_cost_usd={settings.default_max_cost_usd}"
    )


# ── Teams ────────────────────────────────────────────────────────────────────


@app.get("/api/teams")
async def list_teams(request: Request):
    return await _proxy(_client(request), f"{GATEWAY}/api/v1/teams")


# ── Analytics proxies ────────────────────────────────────────────────────────


@app.get("/api/analytics/token-usage")
async def token_usage(request: Request, hours: int = 24):
    days = max(1, min(30, (hours + 23) // 24))
    summary = await _proxy(
        _client(request), f"{GATEWAY}/api/v1/analytics/token-usage?hours={hours}"
    )
    daily = await _proxy(
        _client(request), f"{GATEWAY}/api/v1/analytics/token-usage/daily?days={days}"
    )
    payload = summary if isinstance(summary, dict) else {}
    payload["usage"] = daily if isinstance(daily, list) else []
    return payload


@app.get("/api/analytics/token-usage/daily")
async def token_usage_daily(request: Request, days: int = 7):
    return await _proxy(
        _client(request), f"{GATEWAY}/api/v1/analytics/token-usage/daily?days={days}"
    )


@app.get("/api/analytics/cost-by-team")
async def cost_by_team(request: Request, hours: int = 24):
    return await _proxy(
        _client(request), f"{GATEWAY}/api/v1/analytics/cost-by-team?hours={hours}"
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
async def usage_top_routes(request: Request, since_days: int = 7, limit: int = 20):
    return await _proxy(
        _client(request),
        f"{GATEWAY}/api/v1/usage/top-routes?since_days={since_days}&limit={limit}",
    )


@app.get("/api/usage/top-callers")
async def usage_top_callers(
    request: Request,
    route: str | None = None,
    since_days: int = 7,
    limit: int = 20,
):
    url = f"{GATEWAY}/api/v1/usage/top-callers?since_days={since_days}&limit={limit}"
    if route:
        url += f"&route={quote(route, safe='')}"
    return await _proxy(_client(request), url)


@app.get("/api/usage/service-health")
async def usage_service_health(request: Request, since_days: int = 7):
    return await _proxy(
        _client(request),
        f"{GATEWAY}/api/v1/usage/service-health?since_days={since_days}",
    )


@app.get("/api/usage/error-rates")
async def usage_error_rates(
    request: Request,
    since_days: int = 7,
    min_calls: int = 1,
    limit: int = 30,
):
    return await _proxy(
        _client(request),
        f"{GATEWAY}/api/v1/usage/error-rates?since_days={since_days}&min_calls={min_calls}&limit={limit}",
    )


@app.get("/api/usage/latency-percentiles")
async def usage_latency_percentiles(
    request: Request,
    since_days: int = 7,
    min_calls: int = 5,
    route_limit: int = 20,
):
    return await _proxy(
        _client(request),
        f"{GATEWAY}/api/v1/usage/latency-percentiles?since_days={since_days}&min_calls={min_calls}&route_limit={route_limit}",
    )


@app.get("/api/contracts/current")
async def contracts_current(request: Request):
    return await _proxy(_client(request), f"{GATEWAY}/api/v1/contracts/current")


@app.get("/api/contracts/service-graph")
async def contracts_service_graph(request: Request):
    return await _proxy(_client(request), f"{GATEWAY}/api/v1/contracts/service-graph")


@app.get("/api/contracts/guardrails")
async def contracts_guardrails(request: Request):
    return await _proxy(_client(request), f"{GATEWAY}/api/v1/contracts/guardrails")


@app.get("/api/contracts/demo/status")
async def contracts_demo_status(request: Request):
    return await _proxy(_client(request), f"{GATEWAY}/api/v1/contracts/demo/status")


@app.get("/api/contracts/changes")
async def contracts_changes(
    request: Request,
    limit: int = 20,
):
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


@app.get("/api/contracts/changes/{change_id}/simulation")
async def contracts_simulation(change_id: int, request: Request):
    return await _proxy(
        _client(request),
        f"{GATEWAY}/api/v1/contracts/changes/{change_id}/simulation",
    )


@app.post("/api/contracts/changes/{change_id}/simulation/verify")
async def contracts_simulation_verify(change_id: int, request: Request):
    try:
        resp = await _client(request).post(
            f"{GATEWAY}/api/v1/contracts/changes/{change_id}/simulation/verify"
        )
        resp.raise_for_status()
        return resp.json()
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail="Upstream unreachable")
    except httpx.HTTPStatusError as exc:
        try:
            payload = exc.response.json()
        except ValueError:
            payload = None
        detail = payload.get("detail") if isinstance(payload, dict) and "detail" in payload else (
            payload if payload is not None else f"Upstream error: {exc.response.text}"
        )
        raise HTTPException(status_code=exc.response.status_code, detail=detail)


@app.post("/api/contracts/demo/advance")
async def contracts_demo_advance(request: Request):
    try:
        resp = await _client(request).post(f"{GATEWAY}/api/v1/contracts/demo/advance")
        resp.raise_for_status()
        return resp.json()
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail="Upstream unreachable")
    except httpx.HTTPStatusError as exc:
        try:
            payload = exc.response.json()
        except ValueError:
            payload = None
        detail = payload.get("detail") if isinstance(payload, dict) and "detail" in payload else (
            payload if payload is not None else f"Upstream error: {exc.response.text}"
        )
        raise HTTPException(status_code=exc.response.status_code, detail=detail)


@app.post("/api/contracts/demo/reset")
async def contracts_demo_reset(request: Request):
    try:
        resp = await _client(request).post(f"{GATEWAY}/api/v1/contracts/demo/reset")
        resp.raise_for_status()
        return resp.json()
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail="Upstream unreachable")
    except httpx.HTTPStatusError as exc:
        try:
            payload = exc.response.json()
        except ValueError:
            payload = None
        detail = payload.get("detail") if isinstance(payload, dict) and "detail" in payload else (
            payload if payload is not None else f"Upstream error: {exc.response.text}"
        )
        raise HTTPException(status_code=exc.response.status_code, detail=detail)


@app.post("/api/contracts/live-jobs/sync")
async def contracts_live_jobs_sync(
    request: Request,
    limit: int = 50,
    include_terminal: bool = True,
):
    sync_flag = "true" if include_terminal else "false"
    try:
        resp = await _client(request).post(
            f"{GATEWAY}/api/v1/contracts/live-jobs/sync?limit={limit}&include_terminal={sync_flag}"
        )
        resp.raise_for_status()
        return resp.json()
    except httpx.ConnectError:
        logger.warning("Upstream unreachable: %s", GATEWAY)
        raise HTTPException(status_code=502, detail=f"Upstream unreachable: {GATEWAY}")
    except httpx.HTTPStatusError as exc:
        try:
            payload = exc.response.json()
        except ValueError:
            payload = None
        detail = payload.get("detail") if isinstance(payload, dict) and "detail" in payload else (
            payload if payload is not None else f"Upstream error: {exc.response.text}"
        )
        headers = {}
        retry_after = exc.response.headers.get("Retry-After")
        if retry_after:
            headers["Retry-After"] = retry_after
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=detail,
            headers=headers or None,
        )


# ── Static file serving (production) ────────────────────────────────────────

project_root = Path(__file__).resolve().parent.parent
frontend_dist_dir = project_root / "frontend" / "dist"
static_dir = frontend_dist_dir if frontend_dist_dir.is_dir() else project_root / "static"
if static_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
