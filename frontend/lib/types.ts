export type DataMode = "demo" | "live" | "replay";
export type BuildingStatus = "nominal" | "advisory" | "critical" | "renewable";
export type BuildingType = "academic" | "hostel" | "laboratory" | "library" | "cafeteria" | "administration";

export interface Building {
  id: string; name: string; type: BuildingType; status: BuildingStatus;
  position: [number, number, number]; footprint: [number, number, number]; floors: number;
  current_power_kw: number; daily_energy_kwh: number; daily_water_liters: number;
  occupancy_percent: number; sustainability_score: number; has_solar: boolean;
  last_updated: string; data_mode: DataMode;
}

export interface Campus {
  id: string; name: string; data_mode: DataMode; building_count: number;
  total_current_power_kw: number; total_daily_energy_kwh: number; total_daily_water_liters: number;
  average_occupancy_percent: number; average_sustainability_score: number;
  buildings: Building[]; generated_at: string;
}

export interface AssistantResponse { answer: string; provider: string; model: string; data_mode: DataMode; }
