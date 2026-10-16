# Architecture — Milestone 1 (Foundation)

## What exists right now

```
GreenGrid_Twin_AI/
  backend/      FastAPI app, demo data provider, energy engine, pytest suite
  frontend/     Next.js 14 (App Router) + TypeScript + Tailwind + React Three Fiber
  shared/       (reserved for cross-language contracts; empty for now)
  sample_data/  demo_campus.json, generated from the live /api/v1/campus response
  docs/         this file
  scripts/      (reserved for setup/deploy scripts; empty for now)
  tests/        (reserved for cross-cutting/e2e tests; empty for now — unit tests
                 currently live in backend/tests)
```

## Backend (`backend/`)

- `app/main.py` — FastAPI app, CORS (origin from `FRONTEND_ORIGIN`), a catch-all
  exception handler that never leaks stack traces, health endpoint.
- `app/core/config.py` — all configuration read from environment variables only;
  no secret has a hardcoded default.
- `app/models/schemas.py` — Pydantic v2 models: `Campus`, `Building`, `Measurement`,
  `EnergyCalculationRequest/Result`, `HealthResponse`.
- `app/services/energy_engine.py` — the deterministic savings calculation from the
  spec: `E = P(W) * hours / 1000`, gross/net savings, controller overhead, cost,
  optional emissions. Pure function, no I/O, fully unit-testable.
- `app/data/demo_provider.py` — a fixed (non-random) 6-building demo campus. This is
  the "clearly labelled deterministic demo data provider" the spec requires so the
  app works with no database configured.
- `app/api/v1/routes.py` — implemented endpoints only (see below). No stub endpoints
  that return fake data — anything not implemented simply doesn't exist yet, which
  is intentional: "only present a feature as operational when its implementation
  exists."

### Implemented endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/health` | mode, environment, DB connection status |
| GET | `/api/v1/campus` | aggregated campus totals + all buildings |
| GET | `/api/v1/buildings` | list of buildings |
| GET | `/api/v1/buildings/{id}` | 404 with a clear message if unknown |
| GET | `/api/v1/measurements?building_id=&metric=&hours=` | deterministic diurnal demo series, 1–168h |
| POST | `/api/v1/optimization/evaluate` | runs the energy engine on posted device loads |

Everything else in the spec's proposed API surface (`/api/v1/simulations/run`,
`/api/v1/occupancy/evaluate`, `/api/v1/alerts`, `/api/v1/forecasts`, etc.) is **not
implemented yet** — it belongs to later milestones (occupancy controller, vision,
forecasting, alerts) and is intentionally left out rather than faked.

## Frontend (`frontend/`)

- Next.js 14 App Router, TypeScript, Tailwind.
- `app/layout.tsx` — shell: left nav (14 sections from the spec; only "Campus
  Overview" and "3D Digital Twin" are real links, the rest are visibly marked
  "Planned" rather than silently missing) + a DEMO/LIVE/REPLAY data-mode badge.
- `app/page.tsx` — Campus Overview: stat cards + building table, fetched from the
  backend at runtime, with a loading skeleton and an explicit error state if the
  backend is unreachable (never silently falls back to fabricated numbers).
- `app/twin/page.tsx` + `components/CampusScene.tsx` — the 3D Digital Twin: a real
  React Three Fiber scene (not a flat image with hotspots). Buildings are
  positioned boxes colored by status (`nominal`/`advisory`/`critical`, plus a
  rooftop slab for solar-equipped buildings), with hover labels, click-to-select,
  a lerped camera fly-to toward the selected building, OrbitControls (orbit/pan/
  zoom), and a "Return to campus view" reset. A legend makes status readable
  without relying on color alone.
- `lib/api.ts` / `lib/types.ts` — typed API client; the only place that knows the
  backend's base URL (`NEXT_PUBLIC_API_BASE_URL`).

### Known placeholder

`next/font/google` (Space Grotesk + Inter) was planned for the type system but this
sandbox cannot reach `fonts.googleapis.com` to verify the build, so the layout
currently ships with a safe system-font stack instead (see `app/globals.css`). On
Vercel's build servers (full internet access) you can restore the Google Fonts
version:

```tsx
import { Inter, Space_Grotesk } from "next/font/google";
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", weight: ["500","700"] });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });
// add `className={`${display.variable} ${body.variable}`}` back to <html>
```

## What is NOT built yet (honest status, matches Section 2–5 of the spec)

- No database integration (Supabase/Postgres) — demo provider only.
- No occupancy controller, classroom twin, equipment simulation.
- No computer vision / YOLO detection.
- No forecasting models.
- No multi-agent AI or grounded assistant.
- No guided tour state machine / welcome overlay / instructional popups.
- No IoT connectors.
- No financial intelligence beyond the raw cost-avoided field in the energy engine.
- No actual Vercel/Render deployment has been performed (this conversation's
  environment has no credentials or network path to either service) — the apps are
  built and tested locally/in-container only, and are structured to deploy cleanly
  once pushed to GitHub and connected by the user.

These map directly to Milestones 4–11 in the spec's Section 10 and are the
intended next increments.
