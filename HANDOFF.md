# HANDOFF.md — GreenGrid Twin AI

Last updated: 2026-10-15T07:38:00Z (UTC)

## Current milestone

**Milestone 1 complete, Milestone 4 substantially complete, Milestone 5 started, Sustainability Simulation demo added** (spec Section 10 numbering):
- Milestone 1 — Inspect & stabilize: N/A, this was a from-scratch build (user
  confirmed no prior project existed).
- Milestone 2 — Energy engine, tests: **done**.
- Milestone 3 — Vercel/Render-shaped monorepo architecture: **done** (structure
  in place; actual cloud deployment not yet performed — see "Not done" below).
- Milestone 4 — Premium 3D campus, camera controls, building selection:
  **done for the current demo scope** (procedural architectural facades,
  windows, roof plant, solar arrays, roads, walkways, trees, lamps, lighting,
  shadows, status materials, and camera interaction).
- Milestone 5 — Guided tour: **started** (welcome overlay, 3 tour steps, replay,
  skip, and tour dismissal on building selection).
- Sustainability Simulation demo: **implemented** (continuous procedural
  classroom automation, solar/wind generation, animated EV/ICE traffic,
  vehicle CO2 estimates, hostel food-waste biogas, cost/payback comparison,
  and grid-versus-renewables what-if metrics).
- Classroom and demo UX: **implemented** (visible animated students entering
  and leaving a transparent classroom, occupancy-linked light/fan state,
  Play full demo sequence, fit-campus reset, fullscreen action, unrestricted
  orbit/zoom limits, and Indian rupee cost/payback display).
- Full demo tour: **implemented** (the Play full demo button visits every demo
  building and then classroom, solar, wind, traffic, and biogas stops with
  automatic camera focus and a visible progress label).
- Daylight visual pass: **implemented** (bright sky/fog, lighter building
  facades, readable roads and ground, brighter windows, daylight hemisphere,
  stronger sun, higher exposure, and lighter grid lines for full-campus
  visibility).
- Renewable optimization UX: **implemented** (clickable solar/wind/biogas
  dashboard, sunlight and wind intensity drivers, renewable share and grid
  avoided metrics, synchronized building-focus zoom, and animated biogas
  particles flowing through a pipe back to the cafeteria kitchen).
- Financial comparison UX: **implemented** (second clickable ₹ cost graph
  dashboard comparing normal city electricity with post-install solar, wind,
  biogas, and classroom automation; contribution bars, LPG avoided, install
  estimate, payback, monthly/annual savings, and cumulative savings curve).
- Wind farm visual pass: **implemented** (three tall staggered turbines with
  tapered towers, nacelles, hub assemblies, three long blades, base plates,
  animated rotors, and readable kW labels).
- Motion refinement: **implemented** (vehicles follow a dedicated marked
  outer-perimeter four-sided campus track beyond all building footprints, wind turbine rotors turn clockwise, and student
  animation is constrained between an interior doorway zone and classroom
  desks so no students spawn outside the building).
- Milestones 6–11: **not started**.

## Working features (verified, not claimed)

Backend:
- `GET /api/v1/health`, `/api/v1/campus`, `/api/v1/buildings`,
  `/api/v1/buildings/{id}`, `/api/v1/measurements`,
  `POST /api/v1/optimization/evaluate` — all implemented, all tested.
- Deterministic energy-savings engine matching the spec's exact formulas.
- CORS, global exception handler (no stack-trace leakage), env-var-only config.

Frontend:
- Campus Overview page: live stat cards + building table from the real API,
  loading skeleton, explicit error state (no fabricated fallback data).
- 3D Digital Twin page: real Three.js scene via React Three Fiber — orbit/pan/
  zoom, hover labels, click-to-select, camera fly-to on selection, "return to
  campus view" reset, color-coded + legend-labeled building status, building
  detail side panel with live data.
- Left nav lists all 14 spec sections; only the 2 built ones are real links,
  the other 12 are visibly marked "Planned."
- DEMO/LIVE/REPLAY data-mode badge in the header.

## Files changed / created

Entire repo is new. See `docs/ARCHITECTURE.md` for the full file tree and a
per-file description of what each one does.

## Tests passed / failed / skipped

- Backend: **18 passed, 0 failed, 0 skipped** (`pytest -v` in `backend/`,
  Python 3.12.3). Covers hand-calculated energy-engine cases (single device,
  multi-device sum with no double counting, zero baseline handled safely,
  negative savings preserved not clamped, overhead erasing gross savings,
  assumptions always populated) and API cases (health, campus/building
  reconciliation, 404 on unknown building, measurement validation, optimize
  endpoint matching the engine directly).
- Frontend: `npm run build` — **compiled successfully**, TypeScript check
  passed, ESLint passed, all 3 routes statically generated. No automated
  frontend unit/browser tests exist yet (spec's Section 8 browser-level smoke
  tests are a later milestone) — the "tests" performed here were a real
  production build + a live curl-based smoke test of both running servers
  together (see below), not unit tests.
- End-to-end smoke test: backend (`uvicorn`) and frontend (`next start`, the
  production build) run simultaneously in this container; confirmed
  `/api/v1/health`, `/` (contains "Campus Overview"), and `/twin` (HTTP 200)
  all respond correctly with the frontend pointed at the real backend via
  `NEXT_PUBLIC_API_BASE_URL`.

## Known limitations

- No database (Supabase/Postgres) wired up — demo provider only, by design for
  this milestone.
- 3D scene uses procedural geometry rather than external/licensed GLB assets;
  this keeps the deployment self-contained and reliable on Vercel while still
  providing architectural facades, windows, roof equipment, solar panels,
  roads, landscaping, lamps, shadows, and status lighting.
- The simulation uses clearly labeled deterministic demo assumptions rather than
  claiming camera, occupancy, vehicle, or food-waste sensors are connected.
  Classroom fans/lights turn off when the simulated class is empty; renewable,
  traffic, and biogas metrics update continuously for demonstration.
- Financial figures are displayed in INR using the demo tariff and assumptions;
  they are not a quote for installation or an invoice.
- No occupancy, vision, forecasting, multi-agent AI, assistant, IoT, or
  financial-intelligence features yet — intentionally absent rather than
  faked (see README's "Honesty notes").
- Typography uses a system-font fallback stack, not Google Fonts, because
  this sandboxed container cannot reach fonts.googleapis.com to verify a
  next/font/google build. This is a container limitation, not a Vercel
  limitation — see docs/ARCHITECTURE.md for the exact snippet to restore
  Google Fonts once deployed.
- No actual deployment to Vercel or Render has been performed or can be
  performed from this chat environment (no credentials, no network path to
  either service from this container).

## Dependencies

- Backend: Python 3.11/3.12, fastapi 0.115.0, uvicorn 0.30.6, pydantic 2.9.2,
  httpx 0.27.2, pytest 8.3.3, python-dotenv 1.0.1 (see `backend/requirements.txt`).
- Frontend: Next.js 14.2.35 (patched — 14.2.15 had a known CVE, upgraded),
  React 18.3.1, three 0.160.0, @react-three/fiber 8.15.19, @react-three/drei
  9.102.6, recharts 2.12.7, framer-motion 11.2.10, Tailwind 3.4.3 (see
  `frontend/package.json`).

## Startup instructions

See README.md "Quick start" — both backend and frontend run with standard
`uvicorn`/`npm run dev` commands locally.

## Deployment state

**Deployment configuration ready, cloud deployment not performed.** The repo
now includes `render.yaml`, `frontend/vercel.json`, and `docs/DEPLOYMENT.md`.
The frontend production build and lint pass locally. Actual cloud deployment
still requires connecting the repository to GitHub/Vercel/Render accounts; no
URLs are fabricated here.

## Last successful checkpoint

This is the first checkpoint: `GreenGrid_Twin_AI_checkpoint_<timestamp>.zip`
(see chat message for exact filename/path and verification).

## Exact next task

Connect the repository to GitHub and deploy using `docs/DEPLOYMENT.md`, then
continue Milestone 5 with camera-targeted tour steps and real user testing.

## Commands needed to resume

```bash
# backend
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000

# frontend (separate terminal)
cd frontend && npm run dev
```
