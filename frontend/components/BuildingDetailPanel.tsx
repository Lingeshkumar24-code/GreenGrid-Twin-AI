"use client";

import { useEffect, useState } from "react";
import type { Building } from "@/lib/types";
import { fetchOccupancyRooms, type OccupancyRoom } from "@/lib/vision";

const STATUS_LABEL: Record<string, string> = {
  nominal: "Within target",
  advisory: "Elevated consumption",
  critical: "Critical alert",
  renewable: "Renewable feature",
};

export default function BuildingDetailPanel({
  building,
  onClose,
}: {
  building: Building;
  onClose: () => void;
}) {
  const [rooms, setRooms] = useState<OccupancyRoom[]>([]);
  const [occupancyError, setOccupancyError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchOccupancyRooms()
      .then((response) => { if (active) setRooms(response.rooms); })
      .catch((error: unknown) => { if (active) setOccupancyError(error instanceof Error ? error.message : "Occupancy snapshots are unavailable."); });
    return () => { active = false; };
  }, [building.id]);

  const matchingRoom = rooms
    .filter((room) => room.building_id === building.id)
    .sort((a, b) => Date.parse(b.last_updated) - Date.parse(a.last_updated))[0];

  return (
    <aside className="absolute bottom-4 right-4 top-16 z-10 w-80 overflow-y-auto rounded-xl border border-white/10 bg-charcoal-900/90 p-5 text-ink-100 shadow-2xl backdrop-blur-md">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-400">{building.type}</p>
          <h2 className="font-display text-lg text-white">{building.name}</h2>
        </div>
        <button onClick={onClose} className="text-ink-400 hover:text-white" aria-label="Close panel">✕</button>
      </div>
      <p className="mb-4 text-sm text-ink-300">{STATUS_LABEL[building.status] ?? building.status}</p>
      <dl className="space-y-3 text-sm">
        <Row label="Current power draw" value={`${building.current_power_kw.toFixed(1)} kW`} />
        <Row label="Energy today" value={`${building.daily_energy_kwh.toFixed(0)} kWh`} />
        <Row label="Water today" value={`${building.daily_water_liters.toFixed(0)} L`} />
        <Row label="Campus occupancy" value={`${building.occupancy_percent.toFixed(0)}%`} />
        <Row label="Sustainability score" value={`${building.sustainability_score} / 100`} />
        <Row label="Floors" value={`${building.floors}`} />
        <Row label="Solar installed" value={building.has_solar ? "Yes" : "No"} />
      </dl>
      <p className="mt-3 text-[10px] leading-4 text-amber-100/80">Building power, energy, water, and campus occupancy above are demo data ({building.data_mode.toUpperCase()}). They are separate from uploaded camera results.</p>

      <section className="mt-5 rounded-lg border border-white/10 bg-charcoal-950/80 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-200">Uploaded CV occupancy</h3>
        {occupancyError ? <p className="mt-2 text-xs text-rose-200">{occupancyError}</p> : matchingRoom ? <>
          <p className="mt-2 font-display text-2xl text-white">{matchingRoom.detected_people}<span className="ml-2 text-xs font-normal text-ink-400">detected people</span></p>
          <p className="mt-1 text-xs text-ink-300">{matchingRoom.room_name} · {matchingRoom.occupancy_status.replaceAll("_", " ")}</p>
          <p className="mt-2 text-[10px] leading-4 text-ink-500">Source: {matchingRoom.source === "video_analysis" ? "YOLO26n video analysis" : "YOLO26n image analysis"} · {matchingRoom.evidence_duration_seconds.toFixed(1)} s evidence · confidence {Math.round(matchingRoom.detection_quality * 100)}%</p>
          <p className="mt-1 text-[10px] text-ink-500">Room energy: {matchingRoom.energy_data_source === "meter" ? `${matchingRoom.current_energy_kw ?? "—"} kW (meter)` : "unavailable — no meter connected"}</p>
        </> : <p className="mt-2 text-xs leading-5 text-ink-500">No upload-derived occupancy snapshot is linked to this building. On the Occupancy page, use building ID <span className="text-ink-300">{building.id}</span> to connect a room upload.</p>}
      </section>

      <p className="mt-4 text-xs text-ink-500">Building data last updated {new Date(building.last_updated).toLocaleString()} · {building.data_mode.toUpperCase()} data</p>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-2">
      <dt className="text-ink-400">{label}</dt>
      <dd className="font-medium text-white">{value}</dd>
    </div>
  );
}
