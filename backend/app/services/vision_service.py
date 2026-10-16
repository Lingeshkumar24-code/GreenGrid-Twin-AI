from __future__ import annotations

import base64
import importlib.util
import os
import re
import threading
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from typing import Any

from app.core.config import get_settings


class VisionUnavailableError(RuntimeError):
    pass


class VisionInputError(ValueError):
    pass


class VisionService:
    """Lazy, process-wide YOLO model wrapper. Inference is serialized for CPU safety."""

    def __init__(self) -> None:
        self._model: Any | None = None
        self._model_lock = threading.RLock()
        self._load_lock = threading.Lock()

    @property
    def settings(self):
        return get_settings()

    @staticmethod
    def _supports_yolo26() -> bool:
        try:
            parts = tuple(int(part) for part in re.findall(r"\d+", version("ultralytics"))[:3])
        except (PackageNotFoundError, ValueError):
            return False
        return parts >= (8, 4, 3)

    def status(self) -> dict[str, Any]:
        deps_ok = importlib.util.find_spec("ultralytics") is not None and importlib.util.find_spec("cv2") is not None
        if deps_ok:
            deps_ok = self._supports_yolo26()
        weights = self.settings.vision_model_weights
        path = Path(weights).expanduser()
        weights_ok = path.is_file() or weights == "yolo26n.pt"
        detail = "Model dependencies available; weights will load on first analysis." if deps_ok and weights_ok else ""
        if not deps_ok:
            detail = "Computer vision dependencies are missing or too old for YOLO26. Install backend/requirements.txt (Ultralytics 8.4.3 or newer)."
        elif not weights_ok:
            detail = f"Configured model weights were not found: {path.name}. Set VISION_MODEL_WEIGHTS to a valid file."
        return {
            "available": deps_ok and weights_ok,
            "model_identifier": weights,
            "weights_loaded": self._model is not None,
            "tracker": "ByteTrack",
            "detail": detail,
        }

    def _get_model(self):
        with self._load_lock:
            if self._model is not None:
                return self._model
            if importlib.util.find_spec("ultralytics") is None:
                raise VisionUnavailableError("Computer vision dependencies are not installed. Install backend/requirements.txt.")
            if not self._supports_yolo26():
                raise VisionUnavailableError("YOLO26 requires Ultralytics 8.4.3 or newer. Install backend/requirements.txt.")
            try:
                from ultralytics import YOLO
            except Exception as exc:
                raise VisionUnavailableError(f"Could not import Ultralytics: {type(exc).__name__}.") from exc
            weights = self.settings.vision_model_weights
            weight_path = Path(weights).expanduser()
            if weights != "yolo26n.pt" and not weight_path.is_file():
                raise VisionUnavailableError(f"Configured model weights were not found: {weight_path.name}.")
            try:
                # Ultralytics downloads the official yolo26n.pt checkpoint on first use
                # if it is not already cached. A local custom path must already exist.
                self._model = YOLO(weights)
            except Exception as exc:
                raise VisionUnavailableError(f"YOLO model initialization failed: {type(exc).__name__}.") from exc
            return self._model

    @staticmethod
    def _cv2():
        try:
            import cv2
        except Exception as exc:
            raise VisionUnavailableError("OpenCV is not installed. Install backend/requirements.txt.") from exc
        return cv2

    @staticmethod
    def _person_class_ids(model) -> list[int]:
        names = model.names
        if isinstance(names, dict):
            found = [int(class_id) for class_id, name in names.items() if str(name).lower() == "person"]
        else:
            found = [index for index, name in enumerate(names) if str(name).lower() == "person"]
        if not found:
            raise VisionUnavailableError("The configured model has no class named 'person'; use YOLO26n COCO weights or a compatible person model.")
        return found

    def detect_image(self, image_bytes: bytes) -> dict[str, Any]:
        cv2 = self._cv2()
        import numpy as np

        encoded = np.frombuffer(image_bytes, dtype=np.uint8)
        image = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
        if image is None:
            raise VisionInputError("The uploaded file is not a readable image.")
        if image.shape[0] * image.shape[1] > self.settings.vision_max_pixels:
            raise VisionInputError("Image dimensions exceed the configured processing limit.")
        with self._model_lock:
            model = self._get_model()
            try:
                class_ids = self._person_class_ids(model)
                results = model.predict(
                    source=image,
                    conf=self.settings.vision_confidence,
                    classes=class_ids,
                    device="cpu",
                    verbose=False,
                )
            except VisionUnavailableError:
                raise
            except Exception as exc:
                raise VisionUnavailableError(f"YOLO image inference failed: {type(exc).__name__}.") from exc
        result = results[0]
        boxes = result.boxes
        detections: list[dict[str, Any]] = []
        canvas = image.copy()
        if boxes is not None:
            coordinates = boxes.xyxy.cpu().tolist()
            confidences = boxes.conf.cpu().tolist()
            for coords, confidence in zip(coordinates, confidences):
                x1, y1, x2, y2 = [int(round(value)) for value in coords]
                detections.append({"bbox_xyxy": tuple(float(v) for v in coords), "confidence": float(confidence), "track_id": None})
                cv2.rectangle(canvas, (x1, y1), (x2, y2), (54, 211, 153), 2)
                cv2.putText(canvas, f"person {confidence:.2f}", (x1, max(18, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (54, 211, 153), 2)
        ok, jpg = cv2.imencode(".jpg", canvas, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        if not ok:
            raise VisionUnavailableError("Could not encode the annotated image preview.")
        mean_confidence = sum(d["confidence"] for d in detections) / len(detections) if detections else 0.8
        return {
            "detected_people": len(detections),
            "detections": detections,
            "detection_quality": round(float(mean_confidence), 3),
            "annotated_image_data_url": "data:image/jpeg;base64," + base64.b64encode(jpg.tobytes()).decode("ascii"),
        }

    def analyze_video(self, video_path: str) -> dict[str, Any]:
        cv2 = self._cv2()
        path = Path(video_path)
        capture = cv2.VideoCapture(str(path))
        if not capture.isOpened():
            capture.release()
            raise VisionInputError("The uploaded video could not be opened. Try MP4/H.264 or another supported video.")
        fps = float(capture.get(cv2.CAP_PROP_FPS) or 0)
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        capture.release()
        if fps <= 0 or frame_count <= 0 or width <= 0 or height <= 0:
            raise VisionInputError("The video has invalid or unreadable media metadata.")
        if width * height > self.settings.vision_max_pixels:
            raise VisionInputError("Video frame dimensions exceed the configured processing limit.")
        duration = frame_count / fps
        if duration > self.settings.vision_max_video_seconds:
            raise VisionInputError(f"Video is longer than the configured {self.settings.vision_max_video_seconds}-second limit.")

        with self._model_lock:
            model = self._get_model()
            counts: list[int] = []
            all_track_ids: set[int] = set()
            confidences: list[float] = []
            preview: str | None = None
            try:
                # Use the library's video stream so ByteTrack state is carried
                # between consecutive sampled frames and reset for this source.
                results = model.track(
                    source=str(path),
                    stream=True,
                    persist=False,
                    tracker="bytetrack.yaml",
                    conf=self.settings.vision_confidence,
                    classes=self._person_class_ids(model),
                    device="cpu",
                    vid_stride=self.settings.vision_sample_every,
                    verbose=False,
                )
                for result in results:
                    boxes = result.boxes
                    count = len(boxes) if boxes is not None else 0
                    counts.append(count)
                    if boxes is not None:
                        if boxes.conf is not None and len(boxes.conf):
                            confidences.extend(float(v) for v in boxes.conf.cpu().tolist())
                        if boxes.id is not None:
                            all_track_ids.update(int(v) for v in boxes.id.int().cpu().tolist())
                    frame = result.plot()
                    ok, jpg = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 82])
                    if ok:
                        preview = "data:image/jpeg;base64," + base64.b64encode(jpg.tobytes()).decode("ascii")
            except VisionUnavailableError:
                raise
            except VisionInputError:
                raise
            except Exception as exc:
                raise VisionUnavailableError(f"YOLO/ByteTrack video analysis failed: {type(exc).__name__}.") from exc
        if not counts:
            raise VisionInputError("No video frames could be decoded for analysis.")
        current = counts[-1]
        mean_occupancy = sum(counts) / len(counts)
        quality = sum(confidences) / len(confidences) if confidences else 0.8
        return {
            "current_occupancy": current,
            "average_occupancy": round(mean_occupancy, 2),
            "peak_occupancy": max(counts),
            "frames_processed": len(counts),
            "observed_duration_seconds": round(duration, 2),
            "tracked_ids_seen": len(all_track_ids),
            "detection_quality": round(float(quality), 3),
            "annotated_preview_data_url": preview,
            # Entry/exit direction cannot be inferred reliably without a configured crossing line.
            "estimated_entries": None,
            "estimated_exits": None,
        }


vision_service = VisionService()
