# Computer vision and classroom occupancy

This module extends GreenGrid Twin AI's FastAPI API, Next.js frontend, and deterministic energy calculator. It accepts uploaded images and prerecorded clips; it does not require a physical camera. The model initializes lazily so campus and energy endpoints remain usable when computer-vision dependencies or weights are unavailable.

## Installation

For CPU-only local development (the application explicitly requests CPU inference), from `backend/`:

```bash
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements-cpu.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

`requirements-cpu.txt` pins compatible CPU-only PyTorch/torchvision builds in `requirements-cpu-constraints.txt`; this avoids pulling CUDA libraries onto CPU hosts. If you update PyTorch, update the paired pins and re-run CPU inference checks. `ultralytics==8.4.178` supplies the YOLO26-capable runtime; `lap==0.5.13` supplies ByteTrack's association solver. The default model is the official pretrained `yolo26n.pt`; the runtime downloads it on first inference if it is not cached. A configured custom `VISION_MODEL_WEIGHTS` path must already exist. Model loading and inference failures are returned as explicit errors, not mocked detections. This project installs one OpenCV distribution (`opencv-python`); do not also install `opencv-python-headless` in the same environment. Check Ultralytics licensing terms for your use case.

From `frontend/`, in a second terminal:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000/occupancy`. Choose an image or prerecorded clip, enter room/building ID and optional capacity, then run analysis. If `building_id` matches a campus building, its latest upload-derived room snapshot appears in that building's 3D twin detail panel. The twin's campus power, energy, water and campus-wide occupancy values remain simulated demo data; they are separate from uploaded CV results.

## API

- `GET /api/v1/vision/status` reports package/model readiness without loading model weights. `weights_loaded` becomes true after the first successful load.
- `POST /api/v1/vision/detect-image` accepts multipart fields `file`, `room_id`, `room_name`, optional `building_id`, and optional `capacity`; returns YOLO detections, confidences, boxes, an annotated JPEG data URL and occupancy metadata.
- `POST /api/v1/vision/analyze-video` accepts the same metadata and returns HTTP 202 with a job ID; sampled-frame inference runs as a background task.
- `GET /api/v1/vision/jobs/{job_id}` returns queued/processing/completed/failed status and final sampled-frame statistics.
- `GET /api/v1/occupancy/rooms` and `GET /api/v1/occupancy/rooms/{room_id}` return latest in-memory room snapshots.
- `GET /api/v1/energy/recommendations` lists advisory room recommendations and reports that power data is unavailable.
- `POST /api/v1/energy/occupancy-evaluate` runs the existing energy calculator only when the latest room snapshot is sufficiently reliable and `EMPTY_CONFIRMED`. Device power, baseline/optimized hours and tariff are hypothetical inputs; the response is simulation only. No control action is performed.

Image example:

```bash
curl -X POST http://localhost:8000/api/v1/vision/detect-image \
  -F 'file=@classroom.jpg' \
  -F 'room_id=classroom-101' \
  -F 'room_name=Classroom 101' \
  -F 'building_id=bldg-academic-a' \
  -F 'capacity=40'
```

Video example:

```bash
curl -X POST http://localhost:8000/api/v1/vision/analyze-video \
  -F 'file=@classroom.mp4' \
  -F 'room_id=classroom-101' \
  -F 'room_name=Classroom 101' \
  -F 'building_id=bldg-academic-a' \
  -F 'capacity=40'
# Poll the returned job ID:
curl http://localhost:8000/api/v1/vision/jobs/JOB_ID
```

The occupancy page exposes an **Illustrative calculation** form after `EMPTY_CONFIRMED`; it asks for one device load's wattage, baseline/optimized hours and tariff. One image, a current occupied state, or uncertain/short evidence cannot be used for this evaluation.

## Settings and safeguards

- `VISION_MODEL_WEIGHTS`: defaults to `yolo26n.pt`.
- `VISION_CONFIDENCE`: person-detection threshold, default `0.35`.
- `VISION_MIN_QUALITY`: below this, the status becomes camera/model uncertain.
- `VISION_SAMPLE_EVERY`: process every Nth video frame, default `5`.
- `VISION_MAX_UPLOAD_MB`: upload ceiling, default `50` MB.
- `VISION_MAX_VIDEO_SECONDS`: duration ceiling, default `120` seconds.
- `VISION_EMPTY_CONFIRM_SECONDS`: minimum clip duration for a sustained-empty status, default `60` seconds.
- `VISION_MAX_PIXELS`: decoded image/frame size ceiling, default `12,000,000` pixels.

Snapshots/jobs are in process memory only; they clear on restart and are not shared across multiple server instances. Uploaded video files are removed after processing. Images and annotated previews are returned transiently; source images are not retained. Track IDs are temporary ByteTrack associations, not person identities. Entry/exit counts are omitted without a calibrated crossing line. The project has no power meter or equipment state source, so it does not report measured consumption, savings or wastage and does not switch equipment off.

## Testing and deployment

Run backend tests with `pytest -q` from `backend/`; frontend checks from `frontend/` with `npm run lint` and `npm run build`. Unit/API tests mock the inference boundary, so they must not be treated as proof of model execution.

Audit validation separately ran actual YOLO26n inference against Ultralytics' public `bus.jpg` (4 people; mean confidence `0.809`; annotated preview returned). The live FastAPI multipart image route returned HTTP 200 and the same count. An actual 10-second clip made by repeating that still frame returned HTTP 202 and completed with 4 sampled frames, 4 track IDs, 4 people on the final sample, and an annotated preview. This only validates tracking plumbing on repeated still imagery, not moving-person tracking accuracy. A separate 65-second black clip had 0 detections across 13 sampled frames, and the job reached `EMPTY_CONFIRMED`; an occupancy-energy evaluation then returned the expected hypothetical calculator result. These are test clips, not campus footage or calibration evidence.

The configured Render service uses CPU-only requirements. Still verify the target plan's memory/disk budget, model-cache persistence, request timeout and single-process assumptions before enabling user uploads. The in-memory background task queue is suitable only for a single-process demo, not a durable production workload.
