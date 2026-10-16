from __future__ import annotations

import os
import tempfile
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.models.vision_schemas import (
    EnergyRecommendationsResponse,
    ImageDetectionResponse,
    OccupancyEnergyEvaluationRequest,
    OccupancyEnergyEvaluationResponse,
    OccupancyRoomResponse,
    OccupancyRoomsResponse,
    OccupancyStatus,
    VideoAnalysisResult,
    VideoJobResponse,
    VisionStatusResponse,
)
from app.services.occupancy_service import decision_status, energy_recommendations, get_room, list_rooms, save_room
from app.services.energy_engine import calculate_energy_savings
from app.services.vision_service import VisionInputError, VisionUnavailableError, vision_service

router = APIRouter(prefix="/api/v1")
_jobs: dict[str, dict[str, Any]] = {}
_jobs_lock = threading.RLock()
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
MAX_RETAINED_JOBS = 100


def _safe_id(value: str, label: str) -> str:
    value = value.strip()
    if not value or len(value) > 80 or any(ord(ch) < 32 for ch in value):
        raise HTTPException(status_code=422, detail=f"{label} must be 1-80 printable characters.")
    return value


async def _read_upload(upload: UploadFile, allowed: set[str]) -> bytes:
    name = Path(upload.filename or "upload").name
    suffix = Path(name).suffix.lower()
    if suffix not in allowed:
        raise HTTPException(status_code=415, detail=f"Unsupported file extension. Allowed: {', '.join(sorted(allowed))}.")
    maximum = get_settings().vision_max_upload_mb * 1024 * 1024
    body = await upload.read(maximum + 1)
    if len(body) > maximum:
        raise HTTPException(status_code=413, detail=f"Upload exceeds the {get_settings().vision_max_upload_mb} MB limit.")
    if not body:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    return body


@router.get("/vision/status", response_model=VisionStatusResponse)
def vision_status() -> VisionStatusResponse:
    return VisionStatusResponse(**vision_service.status())


@router.post("/vision/detect-image", response_model=ImageDetectionResponse)
async def detect_image(
    file: UploadFile = File(...),
    room_id: str = Form(default="classroom-101"),
    room_name: str = Form(default="Classroom 101"),
    building_id: str | None = Form(default=None),
    capacity: int | None = Form(default=None, ge=1, le=5000),
) -> ImageDetectionResponse:
    room_id = _safe_id(room_id, "room_id")
    room_name = _safe_id(room_name, "room_name")
    if building_id:
        building_id = _safe_id(building_id, "building_id")
    data = await _read_upload(file, IMAGE_EXTENSIONS)
    try:
        output = await run_in_threadpool(vision_service.detect_image, data)
    except VisionInputError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except VisionUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    status, recommendation = decision_status(output["detected_people"], output["detection_quality"], 0)
    save_room(room_id, room_name, building_id, output["detected_people"], capacity, output["detection_quality"], "image_analysis", 0)
    return ImageDetectionResponse(
        room_id=room_id,
        room_name=room_name,
        building_id=building_id,
        capacity=capacity,
        occupancy_percentage=round(output["detected_people"] / capacity * 100, 1) if capacity else None,
        last_updated=datetime.now(timezone.utc),
        occupancy_status=status,
        recommendation=recommendation,
        note="YOLO26n inference result. This single image is not sufficient to confirm an empty room. No identity recognition or equipment control is performed.",
        **output,
    )


def _process_video_job(job_id: str, path: str, room_id: str, room_name: str, building_id: str | None, capacity: int | None) -> None:
    with _jobs_lock:
        _jobs[job_id]["status"] = "processing"
        _jobs[job_id]["detail"] = "Video analysis is running."
    try:
        raw = vision_service.analyze_video(path)
        status, recommendation = decision_status(raw["current_occupancy"], raw["detection_quality"], raw["observed_duration_seconds"])
        occupancy = round(raw["current_occupancy"] / capacity * 100, 1) if capacity else None
        result = VideoAnalysisResult(
            room_id=room_id,
            room_name=room_name,
            building_id=building_id,
            capacity=capacity,
            occupancy_percentage=occupancy,
            last_updated=datetime.now(timezone.utc),
            occupancy_status=status,
            recommendation=recommendation,
            note="YOLO26n + OpenCV + Ultralytics ByteTrack on sampled video frames. Track IDs are temporary associations, not identified people; entries/exits are omitted without a calibrated crossing line.",
            **raw,
        )
        save_room(room_id, room_name, building_id, raw["current_occupancy"], capacity, raw["detection_quality"], "video_analysis", raw["observed_duration_seconds"])
        with _jobs_lock:
            _jobs[job_id].update(status="completed", detail="Video analysis completed.", result=result.model_dump(mode="json"))
    except (VisionInputError, VisionUnavailableError) as exc:
        with _jobs_lock:
            _jobs[job_id].update(status="failed", detail=str(exc))
    except Exception as exc:
        with _jobs_lock:
            _jobs[job_id].update(status="failed", detail=f"Video analysis failed: {type(exc).__name__}.")
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


@router.post("/vision/analyze-video", response_model=VideoJobResponse, status_code=202)
async def analyze_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    room_id: str = Form(default="classroom-101"),
    room_name: str = Form(default="Classroom 101"),
    building_id: str | None = Form(default=None),
    capacity: int | None = Form(default=None, ge=1, le=5000),
) -> VideoJobResponse:
    room_id = _safe_id(room_id, "room_id")
    room_name = _safe_id(room_name, "room_name")
    if building_id:
        building_id = _safe_id(building_id, "building_id")
    data = await _read_upload(file, VIDEO_EXTENSIONS)
    with _jobs_lock:
        if len(_jobs) >= MAX_RETAINED_JOBS:
            for old_id in list(_jobs):
                if _jobs[old_id]["status"] in ("completed", "failed"):
                    del _jobs[old_id]
                if len(_jobs) < MAX_RETAINED_JOBS:
                    break
        if len(_jobs) >= MAX_RETAINED_JOBS:
            raise HTTPException(status_code=429, detail="Video-analysis queue is full. Try again after active jobs finish.")
    suffix = Path(file.filename or "video.mp4").suffix.lower()
    temp = tempfile.NamedTemporaryFile(prefix="greengrid-vision-", suffix=suffix, delete=False)
    try:
        temp.write(data)
        temp.close()
        job_id = uuid.uuid4().hex
        with _jobs_lock:
            _jobs[job_id] = {"job_id": job_id, "status": "queued", "detail": "Video queued for analysis.", "result": None}
        background_tasks.add_task(_process_video_job, job_id, temp.name, room_id, room_name, building_id, capacity)
    except Exception:
        temp.close()
        try:
            os.unlink(temp.name)
        except OSError:
            pass
        raise
    return VideoJobResponse(job_id=job_id, status="queued", detail="Video queued for analysis.")


@router.get("/vision/jobs/{job_id}", response_model=VideoJobResponse)
def get_video_job(job_id: str) -> VideoJobResponse:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Video-analysis job not found.")
        return VideoJobResponse(**job)


@router.get("/occupancy/rooms", response_model=OccupancyRoomsResponse)
def get_occupancy_rooms() -> OccupancyRoomsResponse:
    return OccupancyRoomsResponse(rooms=[OccupancyRoomResponse(**room) for room in list_rooms()])


@router.get("/occupancy/rooms/{room_id}", response_model=OccupancyRoomResponse)
def get_occupancy_room(room_id: str) -> OccupancyRoomResponse:
    room = get_room(room_id)
    if room is None:
        raise HTTPException(status_code=404, detail=f"No occupancy snapshot found for room '{room_id}'.")
    return OccupancyRoomResponse(**room)


@router.get("/energy/recommendations", response_model=EnergyRecommendationsResponse)
def get_energy_recommendations() -> EnergyRecommendationsResponse:
    return EnergyRecommendationsResponse(
        recommendations=[OccupancyRoomResponse(**room) for room in energy_recommendations()],
        note="Recommendations are advisory only. This installation has no real power meter, timetable, or equipment-control integration; energy usage and savings are not inferred.",
    )


@router.post("/energy/occupancy-evaluate", response_model=OccupancyEnergyEvaluationResponse)
def evaluate_occupancy_energy(payload: OccupancyEnergyEvaluationRequest) -> OccupancyEnergyEvaluationResponse:
    room = get_room(payload.room_id)
    if room is None:
        raise HTTPException(status_code=404, detail=f"No occupancy snapshot found for room '{payload.room_id}'.")
    if room["occupancy_status"] != OccupancyStatus.empty_confirmed:
        raise HTTPException(status_code=409, detail="Energy evaluation requires sustained, sufficiently reliable empty-room evidence.")
    if not payload.calculation.devices:
        raise HTTPException(status_code=422, detail="At least one device load is required for a hypothetical energy calculation.")
    return OccupancyEnergyEvaluationResponse(
        room_id=payload.room_id,
        occupancy_status=room["occupancy_status"],
        current_occupancy=room["detected_people"],
        calculation=calculate_energy_savings(payload.calculation),
        note="Simulation only: the supplied device ratings and operating hours are hypothetical inputs. No power meter is connected and no equipment is controlled.",
    )
