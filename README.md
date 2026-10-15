# GreenGrid Twin AI

AI-powered digital twin for sustainable campus monitoring and resource
optimization. This repository is being built incrementally against a 12-phase
master spec (see `HANDOFF.md` for exactly where things stand).

**Current milestone:** Phase 1 (Dashboard Foundation & Demo Mode) complete,
Phase 2 (3D Digital Twin) substantially complete, and guided tour started. Everything described below is real,
tested, working code — not a mockup.

## What works today

- **Backend** (FastAPI, Python): deterministic demo campus of 6 buildings, a
  hand-verified energy-savings calculation engine, and a REST API — 18/18
  tests passing.
- **Frontend** (Next.js 14 + TypeScript + Tailwind + React Three Fiber): a
  Campus Overview dashboard and a real interactive procedural 3D campus with
  architectural facades, windows, solar arrays, roads, trees, lamps, shadows,
  orbit/zoom, guided tour, and click-to-inspect detail panels — production
  build and lint verified.
- Both have been run together end-to-end in this environment and confirmed
  to talk to each other correctly.

## Quick start

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # edit if needed; defaults work for demo mode
uvicorn app.main:app --reload --port 8000
```

Visit `http://localhost:8000/docs` for interactive API docs, or
`http://localhost:8000/api/v1/campus` for raw demo data.

Run tests:

```bash
pytest -v
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local       # points at http://localhost:8000 by default
npm run dev
```

Visit `http://localhost:3000` (Campus Overview) and
`http://localhost:3000/twin` (3D Digital Twin). The backend must be running
for data to appear — the UI shows an explicit error state rather than
inventing numbers if it can't reach the API.

## Repository layout

```
backend/        FastAPI app, energy engine, demo data, pytest suite
frontend/       Next.js app (3D twin, dashboard)
shared/         reserved for cross-language contracts
sample_data/    a real snapshot of /api/v1/campus for reference/offline use
docs/           architecture notes
scripts/        reserved for setup/deploy scripts
tests/          reserved for cross-cutting/e2e tests
HANDOFF.md      exact current state, what's next, how to resume
```

## Deployment (configuration ready; not performed from this environment)

This codebase includes `frontend/vercel.json` and `render.yaml` for Vercel
(frontend) + Render (backend). See `docs/DEPLOYMENT.md` for the exact
environment variables and provider setup. Actual deployment still requires
connecting this repository to your provider accounts.

## Honesty notes

- All current data is clearly simulated (`DEMO DATA — simulated` badge in the
  UI, `data_mode: "demo"` in every API response). No live sensors are wired
  up yet.
- Features listed in the spec but not yet built (occupancy, forecasting,
  vision, assistant, guided tour, IoT, financial intelligence beyond the raw
  energy engine) are **not** present in the navigation as fake links — they
  are marked "Planned" so nothing claims to work that doesn't.
