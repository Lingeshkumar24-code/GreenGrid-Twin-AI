const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export interface VisionStatusResponse { available: boolean; model_identifier: string; weights_loaded: boolean; tracker: string; detail: string; }
export interface Detection { bbox_xyxy: [number, number, number, number]; confidence: number; track_id: number | null; }
export interface ImageDetectionResponse {
  room_id: string; room_name: string; building_id: string | null; detected_people: number; capacity: number | null;
  occupancy_percentage: number | null; last_updated: string; detection_quality: number; occupancy_status: string;
  source: "image_analysis"; detections: Detection[]; annotated_image_data_url: string; recommendation: string; note: string;
}
export interface VideoAnalysisResult {
  room_id: string; room_name: string; building_id: string | null; capacity: number | null; current_occupancy: number;
  average_occupancy: number; peak_occupancy: number; occupancy_percentage: number | null; frames_processed: number;
  observed_duration_seconds: number; tracked_ids_seen: number; last_updated: string; detection_quality: number;
  occupancy_status: string; annotated_preview_data_url: string | null; estimated_entries: number | null;
  estimated_exits: number | null; recommendation: string; note: string;
}
export interface VideoJobResponse { job_id: string; status: "queued" | "processing" | "completed" | "failed"; detail: string; result: VideoAnalysisResult | null; }
export interface OccupancyRoom {
  room_id: string; room_name: string; building_id: string | null; detected_people: number; capacity: number | null;
  occupancy_percentage: number | null; last_updated: string; detection_quality: number; occupancy_status: string;
  source: "image_analysis" | "video_analysis"; evidence_duration_seconds: number; current_energy_kw: number | null;
  energy_data_source: "unavailable" | "simulated" | "meter"; recommendation: string; note: string;
}
export interface OccupancyEnergyEvaluationResponse {
  room_id: string;
  occupancy_status: string;
  current_occupancy: number;
  calculation: {
    baseline_energy_kwh: number;
    optimized_energy_kwh: number;
    gross_savings_kwh: number;
    controller_overhead_kwh: number;
    net_savings_kwh: number;
    savings_percent: number | null;
    estimated_cost_avoided: number;
    estimated_emissions_avoided_kg: number | null;
    assumptions: string[];
  };
  note: string;
}

async function apiGet<T>(path: string): Promise<T> {
  let res: Response;
  try { res = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store" }); }
  catch { throw new Error("Could not reach the computer vision API."); }
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Request failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}
async function apiPostForm<T>(path: string, body: FormData): Promise<T> {
  let res: Response;
  try { res = await fetch(`${API_BASE_URL}${path}`, { method: "POST", body }); }
  catch { throw new Error("Could not reach the computer vision API."); }
  if (!res.ok) {
    const responseBody = await res.json().catch(() => null) as { detail?: string } | null;
    throw new Error(responseBody?.detail ?? `Request failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchVisionStatus(): Promise<VisionStatusResponse> { return apiGet("/api/v1/vision/status"); }
export function fetchVideoJob(jobId: string): Promise<VideoJobResponse> { return apiGet(`/api/v1/vision/jobs/${encodeURIComponent(jobId)}`); }
export function fetchOccupancyRooms(): Promise<{ rooms: OccupancyRoom[]; data_mode: "live"; persistence: "in_memory" }> { return apiGet("/api/v1/occupancy/rooms"); }

export function evaluateOccupancyEnergy(input: {
  roomId: string;
  powerWatts: number;
  baselineHours: number;
  optimizedHours: number;
  tariffPerKwh: number;
}): Promise<OccupancyEnergyEvaluationResponse> {
  let res: Promise<OccupancyEnergyEvaluationResponse>;
  try {
    res = fetch(`${API_BASE_URL}/api/v1/energy/occupancy-evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room_id: input.roomId,
        calculation: {
          devices: [{ device_id: "hypothetical-room-load", power_watts: input.powerWatts, baseline_hours: input.baselineHours, optimized_hours: input.optimizedHours }],
          controller_overhead_kwh: 0,
          tariff_per_kwh: input.tariffPerKwh,
        },
      }),
    }).then(async (response) => {
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { detail?: string } | null;
        throw new Error(body?.detail ?? `Energy estimate failed with status ${response.status}`);
      }
      return response.json() as Promise<OccupancyEnergyEvaluationResponse>;
    });
  } catch {
    throw new Error("Could not reach the computer vision API.");
  }
  return res;
}

function roomForm(file: File, details: { roomId: string; roomName: string; buildingId?: string; capacity?: number }): FormData {
  const data = new FormData();
  data.append("file", file);
  data.append("room_id", details.roomId);
  data.append("room_name", details.roomName);
  if (details.buildingId) data.append("building_id", details.buildingId);
  if (details.capacity) data.append("capacity", String(details.capacity));
  return data;
}
export function detectImage(file: File, details: { roomId: string; roomName: string; buildingId?: string; capacity?: number }): Promise<ImageDetectionResponse> {
  return apiPostForm("/api/v1/vision/detect-image", roomForm(file, details));
}
export function analyzeVideo(file: File, details: { roomId: string; roomName: string; buildingId?: string; capacity?: number }): Promise<VideoJobResponse> {
  return apiPostForm("/api/v1/vision/analyze-video", roomForm(file, details));
}
