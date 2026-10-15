from __future__ import annotations

from datetime import datetime, timezone

from app.models.schemas import Building, BuildingStatus, BuildingType, Campus, DataMode

# Fixed timestamp so demo mode is fully deterministic and repeatable across runs.
_FIXED_TIMESTAMP = datetime(2026, 10, 15, 9, 0, 0, tzinfo=timezone.utc)

_DEMO_BUILDINGS: list[Building] = [
    Building(
        id="bldg-academic-a",
        name="Academic Block A",
        type=BuildingType.academic,
        status=BuildingStatus.nominal,
        position=(-18, 0, -10),
        footprint=(10, 14, 8),
        floors=4,
        current_power_kw=42.5,
        daily_energy_kwh=610.0,
        daily_water_liters=3200.0,
        occupancy_percent=68.0,
        sustainability_score=82,
        has_solar=True,
        last_updated=_FIXED_TIMESTAMP,
        data_mode=DataMode.demo,
    ),
    Building(
        id="bldg-academic-b",
        name="Academic Block B",
        type=BuildingType.academic,
        status=BuildingStatus.advisory,
        position=(-2, 0, -10),
        footprint=(10, 12, 8),
        floors=3,
        current_power_kw=58.1,
        daily_energy_kwh=790.0,
        daily_water_liters=2800.0,
        occupancy_percent=54.0,
        sustainability_score=63,
        has_solar=False,
        last_updated=_FIXED_TIMESTAMP,
        data_mode=DataMode.demo,
    ),
    Building(
        id="bldg-library",
        name="Central Library",
        type=BuildingType.library,
        status=BuildingStatus.nominal,
        position=(14, 0, -8),
        footprint=(12, 10, 10),
        floors=2,
        current_power_kw=21.3,
        daily_energy_kwh=340.0,
        daily_water_liters=900.0,
        occupancy_percent=71.0,
        sustainability_score=88,
        has_solar=True,
        last_updated=_FIXED_TIMESTAMP,
        data_mode=DataMode.demo,
    ),
    Building(
        id="bldg-hostel-1",
        name="Hostel Block 1",
        type=BuildingType.hostel,
        status=BuildingStatus.critical,
        position=(-20, 0, 14),
        footprint=(9, 20, 9),
        floors=6,
        current_power_kw=74.8,
        daily_energy_kwh=1120.0,
        daily_water_liters=9800.0,
        occupancy_percent=91.0,
        sustainability_score=47,
        has_solar=False,
        last_updated=_FIXED_TIMESTAMP,
        data_mode=DataMode.demo,
    ),
    Building(
        id="bldg-lab-1",
        name="Engineering Laboratory",
        type=BuildingType.laboratory,
        status=BuildingStatus.advisory,
        position=(2, 0, 12),
        footprint=(11, 8, 9),
        floors=2,
        current_power_kw=63.4,
        daily_energy_kwh=880.0,
        daily_water_liters=1600.0,
        occupancy_percent=38.0,
        sustainability_score=58,
        has_solar=False,
        last_updated=_FIXED_TIMESTAMP,
        data_mode=DataMode.demo,
    ),
    Building(
        id="bldg-cafeteria",
        name="Cafeteria",
        type=BuildingType.cafeteria,
        status=BuildingStatus.nominal,
        position=(18, 0, 10),
        footprint=(9, 6, 9),
        floors=1,
        current_power_kw=15.6,
        daily_energy_kwh=210.0,
        daily_water_liters=4100.0,
        occupancy_percent=45.0,
        sustainability_score=76,
        has_solar=False,
        last_updated=_FIXED_TIMESTAMP,
        data_mode=DataMode.demo,
    ),
]


def get_demo_campus() -> Campus:
    buildings = _DEMO_BUILDINGS
    count = len(buildings)
    total_power = sum(b.current_power_kw for b in buildings)
    total_energy = sum(b.daily_energy_kwh for b in buildings)
    total_water = sum(b.daily_water_liters for b in buildings)
    avg_occupancy = sum(b.occupancy_percent for b in buildings) / count
    avg_score = sum(b.sustainability_score for b in buildings) / count

    return Campus(
        id="campus-main",
        name="GreenGrid Main Campus",
        data_mode=DataMode.demo,
        building_count=count,
        total_current_power_kw=round(total_power, 2),
        total_daily_energy_kwh=round(total_energy, 2),
        total_daily_water_liters=round(total_water, 2),
        average_occupancy_percent=round(avg_occupancy, 2),
        average_sustainability_score=round(avg_score, 2),
        buildings=buildings,
        generated_at=_FIXED_TIMESTAMP,
    )


def get_demo_building(building_id: str) -> Building | None:
    for b in _DEMO_BUILDINGS:
        if b.id == building_id:
            return b
    return None
