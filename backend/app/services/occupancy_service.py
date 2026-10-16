from __future__ import annotations

import threading
from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.models.vision_schemas import OccupancyStatus

_rooms: dict[str, dict[str, Any]] = {}
_rooms_lock = threading.RLock()


def occupancy_percent(people: int, capacity: int | None) -> float | None:
    if capacity is None:
        return None
    return round(people / capacity * 100, 1)


def decision_status(people: int, quality: float, evidence_seconds: float, has_meter_data: bool = False, active_loads: bool = False) -> tuple[OccupancyStatus, str]:
    settings = get_settings()
    if quality < settings.vision_min_quality:
        return OccupancyStatus.sensor_or_camera_uncertain, "Detection quality is below the configured threshold. Verify the camera view and review the result manually."
    if people > 0:
        return OccupancyStatus.occupied, "People were detected. Leave room equipment unchanged based on this observation."
    if evidence_seconds < settings.vision_empty_confirm_seconds:
        return OccupancyStatus.possibly_empty, f"No people were detected in this sample. Keep observing for at least {settings.vision_empty_confirm_seconds} seconds before confirming the room is empty."
    if has_meter_data and active_loads:
        return OccupancyStatus.possible_energy_wastage, "The room appears empty over sustained observations while active loads are reported. Verify the room before switching anything off."
    return OccupancyStatus.empty_confirmed, "The room appears unoccupied over sustained observations. No power-meter data is available, so energy use and savings are not estimated. Verify occupancy before any manual equipment change."


def save_room(room_id: str, room_name: str, building_id: str | None, people: int, capacity: int | None, quality: float, source: str, evidence_seconds: float) -> dict[str, Any]:
    status, recommendation = decision_status(people, quality, evidence_seconds)
    record = {
        "room_id": room_id,
        "room_name": room_name,
        "building_id": building_id,
        "detected_people": people,
        "capacity": capacity,
        "occupancy_percentage": occupancy_percent(people, capacity),
        "last_updated": datetime.now(timezone.utc),
        "detection_quality": quality,
        "occupancy_status": status,
        "source": source,
        "evidence_duration_seconds": round(max(0, evidence_seconds), 2),
        "current_energy_kw": None,
        "energy_data_source": "unavailable",
        "recommendation": recommendation,
        "note": "Occupancy data is held in server memory only. No faces/identities are stored. No equipment is controlled.",
    }
    with _rooms_lock:
        _rooms[room_id] = record
        while len(_rooms) > 500:
            _rooms.pop(next(iter(_rooms)))
    return record


def list_rooms() -> list[dict[str, Any]]:
    with _rooms_lock:
        return sorted((dict(record) for record in _rooms.values()), key=lambda item: item["room_id"])


def get_room(room_id: str) -> dict[str, Any] | None:
    with _rooms_lock:
        record = _rooms.get(room_id)
        return dict(record) if record else None


def energy_recommendations() -> list[dict[str, Any]]:
    # No power meter or equipment-state source is wired in this project. Do not
    # infer consumption or label an empty room as energy wastage without it.
    return list_rooms()


def clear_rooms_for_tests() -> None:
    with _rooms_lock:
        _rooms.clear()
