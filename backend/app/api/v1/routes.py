from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException

from app.core.config import get_settings
from app.data.demo_provider import get_demo_building, get_demo_campus
from app.models.schemas import (
    AssistantRequest,
    AssistantResponse,
    Building,
    Campus,
    DataMode,
    EnergyCalculationRequest,
    EnergyCalculationResult,
    HealthResponse,
    Measurement,
)
from app.services.energy_engine import calculate_energy_savings
from app.services.groq_assistant import answer_with_groq

router = APIRouter(prefix="/api/v1")


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(status="ok", demo_mode=settings.demo_mode, environment=settings.environment, database_connected=False, timestamp=datetime.now(timezone.utc))


@router.get("/campus", response_model=Campus)
def get_campus() -> Campus:
    return get_demo_campus()


@router.get("/buildings", response_model=list[Building])
def list_buildings() -> list[Building]:
    return get_demo_campus().buildings


@router.get("/buildings/{building_id}", response_model=Building)
def get_building(building_id: str) -> Building:
    building = get_demo_building(building_id)
    if building is None:
        raise HTTPException(status_code=404, detail=f"No building found with id '{building_id}'.")
    return building


@router.get("/measurements", response_model=list[Measurement])
def get_measurements(building_id: str, metric: str = "power_kw", hours: int = 24) -> list[Measurement]:
    building = get_demo_building(building_id)
    if building is None:
        raise HTTPException(status_code=404, detail=f"No building found with id '{building_id}'.")
    if hours < 1 or hours > 168:
        raise HTTPException(status_code=422, detail="hours must be between 1 and 168.")
    if metric not in ("power_kw", "water_lph"):
        raise HTTPException(status_code=422, detail="metric must be 'power_kw' or 'water_lph'.")
    base = building.current_power_kw if metric == "power_kw" else building.daily_water_liters / 24
    now = datetime(2026, 10, 15, 9, 0, 0, tzinfo=timezone.utc)
    series: list[Measurement] = []
    for i in range(hours):
        hour_offset = hours - i
        hour_of_day = (now.hour - hour_offset) % 24
        phase = hour_of_day / 24.0
        multiplier = 0.55 + 0.45 * (1 - abs(phase - 0.5) * 2)
        series.append(Measurement(building_id=building_id, metric=metric, value=round(base * multiplier, 2), unit="kW" if metric == "power_kw" else "L/h", timestamp=now - timedelta(hours=hour_offset), data_mode=DataMode.demo))
    return series


@router.post("/optimization/evaluate", response_model=EnergyCalculationResult)
def evaluate_optimization(payload: EnergyCalculationRequest) -> EnergyCalculationResult:
    if not payload.devices:
        raise HTTPException(status_code=422, detail="At least one device load is required.")
    return calculate_energy_savings(payload)


@router.post("/assistant", response_model=AssistantResponse)
def campus_assistant(payload: AssistantRequest) -> AssistantResponse:
    if not get_settings().groq_api_key:
        raise HTTPException(status_code=503, detail="AI assistant is not configured on this deployment.")
    try:
        return answer_with_groq(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
