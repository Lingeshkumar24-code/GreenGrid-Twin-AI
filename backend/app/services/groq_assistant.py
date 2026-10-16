from __future__ import annotations

import httpx

from app.core.config import get_settings
from app.data.demo_provider import get_demo_campus
from app.models.schemas import AssistantResponse, AssistantRequest, DataMode

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


def answer_with_groq(request: AssistantRequest) -> AssistantResponse:
    settings = get_settings()
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is not configured")

    campus = get_demo_campus()
    campus_context = {
        "name": campus.name,
        "data_mode": campus.data_mode.value,
        "totals": {
            "current_power_kw": campus.total_current_power_kw,
            "daily_energy_kwh": campus.total_daily_energy_kwh,
            "daily_water_liters": campus.total_daily_water_liters,
            "average_occupancy_percent": campus.average_occupancy_percent,
            "average_sustainability_score": campus.average_sustainability_score,
        },
        "buildings": [
            {
                "name": building.name,
                "type": building.type.value,
                "status": building.status.value,
                "current_power_kw": building.current_power_kw,
                "daily_energy_kwh": building.daily_energy_kwh,
                "daily_water_liters": building.daily_water_liters,
                "occupancy_percent": building.occupancy_percent,
                "sustainability_score": building.sustainability_score,
                "has_solar": building.has_solar,
            }
            for building in campus.buildings
        ],
    }
    payload = {
        "model": settings.groq_model,
        "temperature": 0.2,
        "max_tokens": 500,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are GreenGrid Copilot, a concise sustainability operations assistant. "
                    "Use only the campus context supplied below. State clearly that values are "
                    "demo/simulated when relevant. Do not invent sensors, alerts, forecasts, or "
                    "actions. Give practical next steps and mention the building name and metric "
                    "when making a recommendation. Campus context: "
                    f"{campus_context}"
                ),
            },
            {"role": "user", "content": request.message},
        ],
    }
    try:
        response = httpx.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {settings.groq_api_key}", "Content-Type": "application/json"},
            json=payload,
            timeout=30.0,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"].strip()
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
        raise RuntimeError("The AI provider could not answer right now") from exc

    return AssistantResponse(answer=content, provider="groq", model=settings.groq_model, data_mode=DataMode.demo)
