# GreenGrid Twin AI — CV integration audit

**Audit date:** 2026-10-16  
**Scope:** video/image upload → YOLO26n → ByteTrack → room occupancy snapshot → conservative energy estimate → frontend and 3D-twin display; dependencies, API/CORS, build/tests, and hosted-service configuration.

## Executive summary

The upload-to-visualization workflow was exercised with actual model inference, not mocked detections. A clean CPU-only install loaded the configured `yolo26n.pt` weights and detected people in an Ultralytics sample. The live FastAPI routes and browser upload flow completed; the 3D twin displayed a room snapshot when its `building_id` matched the selected building.

The core path works in this tested single-process local configuration. Campus telemetry and simulation panels remain **demo/simulated**; only uploaded-image/video detections and their derived room snapshots are model outputs. The hypothetical energy calculation is based on user-entered device assumptions and does not represent metered savings or control equipment.

## Verified end-to-end results

| Step | Test performed | Result |
|---|---|---|
| Runtime/dependencies | Installed `backend/requirements-cpu.txt` in a fresh virtual environment | `torch 2.14.1+cpu`, `torchvision 0.29.1+cpu`; `torch.cuda.is_available()` was false as expected; Ultralytics `8.4.178` and `lap 0.5.13` installed |
| Model loading | Queried `/api/v1/vision/status`, then ran inference | Initially reports lazy load; after inference, weights were loaded and status remained available |
| Real image inference | Ran YOLO26n on Ultralytics' public `bus.jpg` sample | **4 people**, mean detection confidence **0.809**, annotated image returned |
| Image API | Submitted multipart image to `POST /api/v1/vision/detect-image` | HTTP **200**, 4 detected people and annotated preview |
| Real video inference/tracking | Browser-uploaded a 10-second synthetic clip made by repeating the bus still image | `POST /api/v1/vision/analyze-video` returned **202**; job completed with **4 sampled frames**, **4 people** on the final sample, **4 temporary track IDs**, and an annotated preview; the saved room snapshot reported `OCCUPIED`, 4/40 (10%), about 81% detection quality |
| Sustained-empty path | Browser-uploaded a generated 65-second black clip | **13 sampled frames**, zero detections/tracks, `EMPTY_CONFIRMED`; the page unlocked the explicitly labelled hypothetical energy calculator, and the API calculator path was exercised |
| Frontend integration | Used the browser to select video mode, upload clips, submit analysis, view status, preview, counts and occupancy decision | Completed against the live API; no CORS or API-endpoint mismatch was observed |
| Twin visualization | Uploaded with `building_id=bldg-academic-b`, then selected Academic Block B | The detail panel showed **4 detected people**, `OCCUPIED`, YOLO26n video source, 10.0 seconds of evidence and 81% confidence. Adjacent campus power/energy/water/occupancy figures remained labelled demo data. |
| CORS/status | Browser-origin preflight and browser-side API fetch | Preflight allowed the configured UI origin; frontend read vision status with HTTP 200 |

**Tracking limitation:** the video clip repeats one still image. It verifies that the video sampler, ByteTrack association plumbing, result schema and UI rendering operate together; it does **not** establish tracking accuracy for moving people, occlusion, a real camera angle or campus conditions. Validate on authorized representative footage before relying on counts operationally.

## Issues found and changes made

1. **CPU/deployment dependency mismatch.** The default PyTorch install can pull large CUDA runtime packages even though this service explicitly performs CPU inference, and the previous Render build used the generic requirements list. Added `backend/requirements-cpu.txt` and paired CPU torch/torchvision constraints; changed `render.yaml` to install the CPU manifest. Verified a clean install and actual YOLO26n inference under that environment. The ordinary `requirements.txt` remains available for platform-specific/GPU installs.
2. **Navigation component/build failure.** During the audit, the first frontend build exposed `Nav.tsx is not a module`; inspection found the file had become empty. Restored the component, made `/occupancy` a live navigation link, then reran lint and build successfully.
3. **Previously incomplete frontend handoff.** Connected the confirmed-empty-only energy evaluation UI and surfaced a matching upload-derived room snapshot in the selected building detail panel; updated navigation and documentation so implemented functionality is not marked Planned or confused with campus simulation.
4. **Frontend dependency risk.** The original Next.js 14 dependency line was covered by a critical advisory. Upgraded `next` and `eslint-config-next` to **15.5.28**, `@react-three/drei` to **9.122.0**, and PostCSS to **8.5.30** (including the compatible nested Next PostCSS override). Updated the lint script from deprecated `next lint` to the ESLint CLI. The app remains on React 18 and Next 15 rather than taking an untested Next 16/Tailwind 4 migration.
5. **Configuration/docs.** Render remains a configuration, not a deployed service. Updated run instructions, CPU install guidance, vision limits, and simulated-versus-inferred data notes.

## Checks and remaining findings

- Backend: **32 passed**, 0 failed; two upstream deprecation/pending-deprecation warnings from Starlette/AnyIO multipart handling.
- Frontend: clean `npm ci`; `npm run lint` passed; `npm run build` passed with Next.js 15.5.28 and generated `/`, `/occupancy`, `/twin`.
- CPU vision: clean install plus actual model inference passed.
- `npm audit` (full tree): **0 critical, 7 high, 2 moderate** remain. These findings are in Tailwind 3 and development/lint tooling; npm only offers broad fixes through breaking major upgrades (Tailwind 4 and/or Next 16). They have not been silently suppressed. `npm audit --omit=dev` reports **0 vulnerabilities**. Recheck before public deployment and evaluate the major upgrades separately.
- `next dev` and FastAPI were run together for browser checks; no deployment to Vercel or Render was performed.

## Operational and deployment caveats

- The backend uploads/processes prerecorded media; there is no live camera, face recognition, identity store, meter, timetable, or equipment-control integration.
- Occupancy snapshots and video jobs live in process memory and disappear on restart; the background queue is not durable or shared across multiple backend workers/instances. Treat the current hosted configuration as a single-process demo unless storage/worker architecture is added.
- The first inference may download official `yolo26n.pt` weights and requires network access and disk space. A custom `VISION_MODEL_WEIGHTS` path must exist.
- Render configuration now uses CPU wheels, but target-plan memory, writable model-cache space, upload/request timeouts and instance behavior still require provider-side verification.
- Set `FRONTEND_ORIGIN` to the actual deployed Vercel origin before enabling browser calls. The sandbox browser origin allowed during this audit was a temporary test setting, not a production hostname.
- Campus dashboard/twin energy, power, water, renewal and aggregate occupancy metrics are simulation data. Occupancy-derived energy output is an **illustrative calculation** from assumed watts, time and tariff; it is not measured savings.

## Exact local run commands

Prerequisites: Python 3.11/3.12, Node.js (tested on Node 22), npm, network access for dependency/model downloads. Open two terminals from the repository root.

**Terminal 1 — FastAPI, CPU-only vision:**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements-cpu.txt
cp .env.example .env             # edit FRONTEND_ORIGIN only if using another origin
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Next.js frontend:**

```bash
cd frontend
npm ci
cp .env.example .env.local       # default API URL is http://localhost:8000
npm run dev
```

Open `http://localhost:3000/occupancy`. For the 3D view use `http://localhost:3000/twin`. Run backend tests from `backend/` with `pytest -v`; frontend checks from `frontend/` with `npm run lint` and `npm run build`.
