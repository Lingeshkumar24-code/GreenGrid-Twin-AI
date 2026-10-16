from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.models.vision_schemas import OccupancyStatus
from app.services import occupancy_service
from app.services.vision_service import VisionInputError

client = TestClient(app)


def setup_function():
    occupancy_service.clear_rooms_for_tests()


def test_empty_sample_shorter_than_threshold_is_not_confirmed():
    status, _ = occupancy_service.decision_status(0, 0.9, 10)
    assert status == OccupancyStatus.possibly_empty


def test_sustained_empty_without_meter_data_is_confirmed_but_not_energy_wastage():
    status, advice = occupancy_service.decision_status(0, 0.9, 90, has_meter_data=False, active_loads=False)
    assert status == OccupancyStatus.empty_confirmed
    assert "No power-meter data" in advice


def test_low_quality_observation_is_uncertain():
    status, _ = occupancy_service.decision_status(0, 0.1, 900)
    assert status == OccupancyStatus.sensor_or_camera_uncertain


def test_occupied_room_is_never_given_empty_recommendation():
    status, _ = occupancy_service.decision_status(3, 0.9, 900)
    assert status == OccupancyStatus.occupied


def test_possible_wastage_requires_sustained_empty_and_explicit_active_load_data():
    status, _ = occupancy_service.decision_status(0, 0.9, 120, has_meter_data=True, active_loads=True)
    assert status == OccupancyStatus.possible_energy_wastage


def test_vision_status_is_reported_without_loading_model():
    response = client.get("/api/v1/vision/status")
    assert response.status_code == 200
    body = response.json()
    assert body["model_identifier"]
    assert body["tracker"] == "ByteTrack"
    assert body["weights_loaded"] is False


def test_image_upload_returns_annotated_detection_result(monkeypatch):
    monkeypatch.setattr(
        "app.api.v1.vision_routes.vision_service.detect_image",
        lambda _data: {
            "detected_people": 2,
            "detections": [
                {"bbox_xyxy": (1.0, 2.0, 30.0, 40.0), "confidence": 0.91, "track_id": None},
                {"bbox_xyxy": (40.0, 2.0, 70.0, 40.0), "confidence": 0.84, "track_id": None},
            ],
            "detection_quality": 0.875,
            "annotated_image_data_url": "data:image/jpeg;base64,dGVzdA==",
        },
    )
    response = client.post(
        "/api/v1/vision/detect-image",
        data={"room_id": "room-1", "room_name": "Test room", "building_id": "bldg-academic-a", "capacity": "20"},
        files={"file": ("class.jpg", b"mock-image-bytes", "image/jpeg")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["detected_people"] == 2
    assert body["occupancy_percentage"] == 10.0
    assert body["occupancy_status"] == "OCCUPIED"
    assert body["annotated_image_data_url"].startswith("data:image/jpeg;base64,")
    assert client.get("/api/v1/occupancy/rooms/room-1").status_code == 200


def test_invalid_image_is_a_clear_validation_error(monkeypatch):
    def reject(_data):
        raise VisionInputError("The uploaded file is not a readable image.")

    monkeypatch.setattr("app.api.v1.vision_routes.vision_service.detect_image", reject)
    response = client.post(
        "/api/v1/vision/detect-image",
        files={"file": ("bad.png", b"not-an-image", "image/png")},
    )
    assert response.status_code == 422
    assert "not a readable image" in response.json()["detail"]


def test_unsupported_file_type_is_rejected_before_inference():
    response = client.post(
        "/api/v1/vision/detect-image",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert response.status_code == 415


def test_video_job_uses_background_work_and_publishes_occupancy(monkeypatch):
    monkeypatch.setattr(
        "app.api.v1.vision_routes.vision_service.analyze_video",
        lambda _path: {
            "current_occupancy": 4,
            "average_occupancy": 3.2,
            "peak_occupancy": 6,
            "frames_processed": 18,
            "observed_duration_seconds": 75.0,
            "tracked_ids_seen": 8,
            "detection_quality": 0.89,
            "annotated_preview_data_url": "data:image/jpeg;base64,dGVzdA==",
            "estimated_entries": None,
            "estimated_exits": None,
        },
    )
    started = client.post(
        "/api/v1/vision/analyze-video",
        data={"room_id": "video-room", "room_name": "Video Room", "capacity": "32"},
        files={"file": ("class.mp4", b"mock-video-bytes", "video/mp4")},
    )
    assert started.status_code == 202
    job_id = started.json()["job_id"]
    completed = client.get(f"/api/v1/vision/jobs/{job_id}")
    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"
    assert completed.json()["result"]["current_occupancy"] == 4
    assert completed.json()["result"]["tracked_ids_seen"] == 8
    assert client.get("/api/v1/occupancy/rooms/video-room").json()["detected_people"] == 4


def test_missing_occupancy_and_job_return_404():
    assert client.get("/api/v1/occupancy/rooms/no-such-room").status_code == 404
    assert client.get("/api/v1/vision/jobs/no-such-job").status_code == 404


def test_recommendations_never_invent_power_or_savings():
    occupancy_service.save_room("room-x", "Room X", None, 0, None, 0.9, "image_analysis", 2)
    body = client.get("/api/v1/energy/recommendations").json()
    assert body["recommendations"][0]["current_energy_kw"] is None
    assert body["recommendations"][0]["energy_data_source"] == "unavailable"
    assert "no real power meter" in body["note"]


def test_confirmed_empty_room_can_use_existing_energy_engine_for_hypothetical_inputs():
    occupancy_service.save_room("energy-room", "Energy Room", None, 0, 30, 0.9, "video_analysis", 90)
    response = client.post(
        "/api/v1/energy/occupancy-evaluate",
        json={
            "room_id": "energy-room",
            "calculation": {
                "devices": [{"device_id": "fan-1", "power_watts": 100, "baseline_hours": 10, "optimized_hours": 4}],
                "controller_overhead_kwh": 0,
                "tariff_per_kwh": 0,
            },
        },
    )
    assert response.status_code == 200
    assert response.json()["calculation"]["gross_savings_kwh"] == 0.6
    assert "Simulation only" in response.json()["note"]


def test_occupied_room_cannot_enter_empty_room_energy_evaluation():
    occupancy_service.save_room("busy-room", "Busy Room", None, 2, 30, 0.9, "video_analysis", 90)
    response = client.post(
        "/api/v1/energy/occupancy-evaluate",
        json={"room_id": "busy-room", "calculation": {"devices": [{"device_id": "fan-1", "power_watts": 100, "baseline_hours": 10, "optimized_hours": 4}]}},
    )
    assert response.status_code == 409
