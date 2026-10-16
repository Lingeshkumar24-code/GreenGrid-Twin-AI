from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from app.models.schemas import EnergyCalculationRequest, EnergyCalculationResult


class OccupancyStatus(str, Enum):
    occupied = "OCCUPIED"
    possibly_empty = "POSSIBLY_EMPTY"
    empty_confirmed = "EMPTY_CONFIRMED"
    possible_energy_wastage = "POSSIBLE_ENERGY_WASTAGE"
    sensor_or_camera_uncertain = "SENSOR_OR_CAMERA_UNCERTAIN"


class Detection(BaseModel):
    bbox_xyxy: tuple[float, float, float, float]
    confidence: float = Field(ge=0, le=1)
    track_id: int | None = None


class VisionStatusResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    available: bool
    model_identifier: str
    weights_loaded: bool
    tracker: str = "ByteTrack"
    detail: str


class ImageDetectionResponse(BaseModel):
    room_id: str
    room_name: str
    building_id: str | None = None
    detected_people: int = Field(ge=0)
    capacity: int | None = Field(default=None, ge=1)
    occupancy_percentage: float | None = Field(default=None, ge=0)
    last_updated: datetime
    detection_quality: float = Field(ge=0, le=1)
    occupancy_status: OccupancyStatus
    source: Literal["image_analysis"] = "image_analysis"
    detections: list[Detection]
    annotated_image_data_url: str
    recommendation: str
    note: str


class VideoAnalysisResult(BaseModel):
    room_id: str
    room_name: str
    building_id: str | None = None
    capacity: int | None = Field(default=None, ge=1)
    current_occupancy: int = Field(ge=0)
    average_occupancy: float = Field(ge=0)
    peak_occupancy: int = Field(ge=0)
    occupancy_percentage: float | None = Field(default=None, ge=0)
    frames_processed: int = Field(ge=0)
    observed_duration_seconds: float = Field(ge=0)
    tracked_ids_seen: int = Field(ge=0)
    last_updated: datetime
    detection_quality: float = Field(ge=0, le=1)
    occupancy_status: OccupancyStatus
    annotated_preview_data_url: str | None = None
    estimated_entries: int | None = None
    estimated_exits: int | None = None
    recommendation: str
    note: str


class VideoJobResponse(BaseModel):
    job_id: str
    status: Literal["queued", "processing", "completed", "failed"]
    detail: str
    result: VideoAnalysisResult | None = None


class OccupancyRoomResponse(BaseModel):
    room_id: str
    room_name: str
    building_id: str | None = None
    detected_people: int = Field(ge=0)
    capacity: int | None = Field(default=None, ge=1)
    occupancy_percentage: float | None = Field(default=None, ge=0)
    last_updated: datetime
    detection_quality: float = Field(ge=0, le=1)
    occupancy_status: OccupancyStatus
    source: Literal["image_analysis", "video_analysis"]
    evidence_duration_seconds: float = Field(ge=0)
    current_energy_kw: float | None = None
    energy_data_source: Literal["unavailable", "simulated", "meter"] = "unavailable"
    recommendation: str
    note: str


class OccupancyRoomsResponse(BaseModel):
    rooms: list[OccupancyRoomResponse]
    data_mode: Literal["live"] = "live"
    persistence: Literal["in_memory"] = "in_memory"


class EnergyRecommendationsResponse(BaseModel):
    recommendations: list[OccupancyRoomResponse]
    note: str


class OccupancyEnergyEvaluationRequest(BaseModel):
    room_id: str = Field(min_length=1, max_length=80)
    calculation: EnergyCalculationRequest


class OccupancyEnergyEvaluationResponse(BaseModel):
    room_id: str
    occupancy_status: OccupancyStatus
    current_occupancy: int = Field(ge=0)
    calculation: EnergyCalculationResult
    note: str
