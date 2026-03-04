# Dashboard Service

`dashboard-service` is the backend-for-frontend for the platform dashboard. It proxies data from `api-core` and `billing-service`, reshapes it for the UI, and can serve the built React frontend.

## What It Handles

- Aggregate dashboard stats
- Proxy session and team data to the UI
- Combine billing totals with session analytics
- Serve the frontend build in production

## Important Folders

- `src/`: FastAPI proxy and aggregation logic
- `frontend/`: Vite + React dashboard app
- `static/`: built frontend assets used in production
- `tests/`: backend tests

## Quick Start

Backend:

```bash
pip install -r requirements.txt
uvicorn src.main:app --host 127.0.0.1 --port 8003 --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

Settings use the `DASHBOARD_` prefix:

- `DASHBOARD_GATEWAY_URL`
- `DASHBOARD_BILLING_URL`
- `DASHBOARD_API_CORE_API_KEY`

## Main Endpoints

- `/health`
- `/api/dashboard`
- `/api/sessions`
- `/api/teams`
- `/api/analytics/cost-by-team`

## Testing

```bash
pytest
```
