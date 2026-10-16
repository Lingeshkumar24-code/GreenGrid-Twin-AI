"use client";

import type { SimulationSnapshot } from "@/lib/simulation";

function Metric({ label, value, detail, tone = "emerald" }: { label: string; value: string; detail: string; tone?: "emerald" | "cyan" | "amber" | "rose" }) {
  const colors = { emerald: "text-emerald-200", cyan: "text-cyan-200", amber: "text-amber-200", rose: "text-rose-200" };
  return <div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-[10px] uppercase tracking-[0.16em] text-ink-500">{label}</p><p className={`mt-1 text-lg font-semibold ${colors[tone]}`}>{value}</p><p className="mt-1 text-[10px] leading-4 text-ink-400">{detail}</p></div>;
}

export default function SimulationPanel({ snapshot }: { snapshot: SimulationSnapshot }) {
  const time = `${String(Math.floor(snapshot.hour)).padStart(2, "0")}:${String(snapshot.minute).padStart(2, "0")}`;
  return <aside className="pointer-events-auto absolute left-4 top-16 z-20 w-[min(310px,calc(100vw-2rem))] rounded-2xl border border-emerald-200/15 bg-[#10211c]/92 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl">
    <div className="flex items-center justify-between px-1 pb-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">Live campus simulation</p><p className="mt-1 text-xs text-ink-400">Auto-running demo · {time} campus time</p></div><span className="flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-200"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />LIVE</span></div>
    <div className="grid grid-cols-2 gap-2">
      <Metric label="Classrooms" value={snapshot.occupied ? `${snapshot.students} inside` : "Empty"} detail={snapshot.occupied ? "Lights + fans ON" : `${snapshot.classroomSavingsKw.toFixed(1)} kW avoided`} tone="cyan" />
      <Metric label="Renewables" value={`${snapshot.renewableKw.toFixed(1)} kW`} detail={`Sun ${snapshot.sunlightPercent}% · wind ${snapshot.windSpeedKmh} km/h`} tone="emerald" />
      <Metric label="Grid draw" value={`${snapshot.gridKw.toFixed(1)} kW`} detail="After solar + wind generation" tone="amber" />
      <Metric label="Mobility CO₂" value={`${snapshot.vehicleKgCo2PerHour.toFixed(2)} kg/h`} detail={`${snapshot.evCount} EV · ${snapshot.otherVehicleCount} other vehicles`} tone="rose" />
      <Metric label="Biogas" value={`${snapshot.biogasKwhPerDay.toFixed(1)} kWh/day`} detail={`${snapshot.foodWasteKgPerDay} kg food waste reused`} tone="emerald" />
      <Metric label="Daily saving" value={`₹${snapshot.dailyCostSaving.toLocaleString("en-IN")}`} detail={`Install ₹${(snapshot.installCost / 100000).toFixed(0)}L · payback ${snapshot.paybackYears} yrs`} tone="cyan" />
    </div>
    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[10px] leading-4 text-ink-300"><span className="font-semibold text-emerald-200">What-if comparison:</span> normal grid-only operation costs about ₹{snapshot.gridOnlyDailyCost.toLocaleString("en-IN")}/day. Solar, wind, biogas and classroom automation save about ₹{snapshot.annualCostSaving.toLocaleString("en-IN")}/year in this demo.</div>
  </aside>;
}
