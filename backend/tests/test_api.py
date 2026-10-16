from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "running"


def test_health_endpoint():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["demo_mode"] is True


def test_campus_endpoint_reconciles_with_buildings():
    response = client.get("/api/v1/campus")
    assert response.status_code == 200
    body = response.json()
    assert body["building_count"] == len(body["buildings"])
    computed_power = sum(b["current_power_kw"] for b in body["buildings"])
    assert abs(computed_power - body["total_current_power_kw"]) < 0.01


def test_list_buildings_matches_campus():
    campus = client.get("/api/v1/campus").json()
    buildings = client.get("/api/v1/buildings").json()
    assert len(buildings) == campus["building_count"]


def test_get_building_not_found_returns_404_with_clear_message():
    response = client.get("/api/v1/buildings/does-not-exist")
    assert response.status_code == 404
    assert "does-not-exist" in response.json()["detail"]


def test_get_building_found():
    response = client.get("/api/v1/buildings/bldg-academic-a")
    assert response.status_code == 200
    assert response.json()["id"] == "bldg-academic-a"


def test_measurements_rejects_out_of_range_hours():
    response = client.get("/api/v1/measurements", params={"building_id": "bldg-academic-a", "hours": 0})
    assert response.status_code == 422


def test_measurements_rejects_unknown_building():
    response = client.get("/api/v1/measurements", params={"building_id": "nope", "hours": 24})
    assert response.status_code == 404


def test_measurements_returns_requested_length():
    response = client.get("/api/v1/measurements", params={"building_id": "bldg-academic-a", "hours": 12})
    assert response.status_code == 200
    assert len(response.json()) == 12


def test_optimization_evaluate_endpoint_matches_engine():
    payload = {
        "devices": [{"device_id": "d1", "power_watts": 100, "baseline_hours": 10, "optimized_hours": 4}],
        "controller_overhead_kwh": 0.5,
        "tariff_per_kwh": 8.0,
    }
    response = client.post("/api/v1/optimization/evaluate", json=payload)
    assert response.status_code == 200
    assert response.json()["net_savings_kwh"] == 0.1


def test_optimization_evaluate_rejects_empty_devices():
    response = client.post("/api/v1/optimization/evaluate", json={"devices": []})
    assert response.status_code == 422
