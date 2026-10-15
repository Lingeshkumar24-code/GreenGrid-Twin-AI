"use client";

import type { Building } from "@/lib/types";

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
  return (
    <aside className="absolute bottom-4 right-4 top-16 z-10 w-80 overflow-y-auto rounded-xl border border-white/10 bg-charcoal-900/90 p-5 text-ink-100 shadow-2xl backdrop-blur-md">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-400">{building.type}</p>
          <h2 className="font-display text-lg text-white">{building.name}</h2>
        </div>
        <button onClick={onClose} className="text-ink-400 hover:text-white" aria-label="Close panel">
          ✕
        </button>
      </div>
      <p className="mb-4 text-sm text-ink-300">{STATUS_LABEL[building.status] ?? building.status}</p>
      <dl className="space-y-3 text-sm">
        <Row label="Current power draw" value={`${building.current_power_kw.toFixed(1)} kW`} />
        <Row label="Energy today" value={`${building.daily_energy_kwh.toFixed(0)} kWh`} />
        <Row label="Water today" value={`${building.daily_water_liters.toFixed(0)} L`} />
        <Row label="Occupancy" value={`${building.occupancy_percent.toFixed(0)}%`} />
        <Row label="Sustainability score" value={`${building.sustainability_score} / 100`} />
        <Row label="Floors" value={`${building.floors}`} />
        <Row label="Solar installed" value={building.has_solar ? "Yes" : "No"} />
      </dl>
      <p className="mt-4 text-xs text-ink-500">
        Last updated {new Date(building.last_updated).toLocaleString()} · {building.data_mode.toUpperCase()} data
      </p>
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
