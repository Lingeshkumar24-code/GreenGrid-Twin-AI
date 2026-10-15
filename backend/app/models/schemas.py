from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class DataMode(str, Enum):
    demo = "demo"
    live = "live"
    replay = "replay"


class BuildingStatus(str, Enum):
    nominal = "nominal"
    advisory = "advisory"
    critical = "critical"
    renewable = "renewable"


class BuildingType(str, Enum):
    academic = "academic"
    hostel = "hostel"
    laboratory = "laboratory"
    library = "library"
    cafeteria = "cafeteria"
    administration = "administration"


class Building(BaseModel):
    id: str
    name: str
    type: BuildingType
    status: BuildingStatus
    position: tuple[float, float, float] = Field(description="x, y, z in 3D scene units")
    footprint: tuple[float, float, float] = Field(description="width, height, depth in 3D scene units")
    floors: int
    current_power_kw: float
    daily_energy_kwh: float
    daily_water_liters: float
    occupancy_percent: float
    sustainability_score: int = Field(ge=0, le=100)
    has_solar: bool = False
    last_updated: datetime
    data_mode: DataMode


class Campus(BaseModel):
    id: str
    name: str
    data_mode: DataMode
    building_count: int
    total_current_power_kw: float
    total_daily_energy_kwh: float
    total_daily_water_liters: float
    average_occupancy_percent: float
    average_sustainability_score: float
    buildings: list[Building]
    generated_at: datetime


class Measurement(BaseModel):
    building_id: str
    metric: str
    value: float
    unit: str
    timestamp: datetime
    data_mode: DataMode


class HealthResponse(BaseModel):
    status: str
    demo_mode: bool
    environment: str
    database_connected: bool
    timestamp: datetime


class DeviceLoad(BaseModel):
    device_id: str
    power_watts: float = Field(gt=0)
    baseline_hours: float = Field(ge=0)
    optimized_hours: float = Field(ge=0)


class EnergyCalculationRequest(BaseModel):
    devices: list[DeviceLoad]
    controller_overhead_kwh: float = Field(default=0.0, ge=0)
    tariff_per_kwh: float = Field(default=0.0, ge=0)
    emissions_factor_kg_per_kwh: Optional[float] = None


class EnergyCalculationResult(BaseModel):
    baseline_energy_kwh: float
    optimized_energy_kwh: float
    gross_savings_kwh: float
    controller_overhead_kwh: float
    net_savings_kwh: float
    savings_percent: Optional[float]
    estimated_cost_avoided: float
    estimated_emissions_avoided_kg: Optional[float]
    assumptions: list[str]


class AssistantRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class AssistantResponse(BaseModel):
    answer: str
    provider: str
    model: str
    data_mode: DataMode
