"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ZONES, type ZoneId } from "@/lib/classroom-engine";
import type { ZoneStates } from "@/lib/classroom-controls";
import type { ClassroomEnergy } from "@/lib/classroom-energy";

const TONES: Record<ZoneId, string> = { A: "#58D6A0", B: "#65BDE8", C: "#C4A4F2", D: "#F0B66B" };

export default function ClassroomAnalytics({ counts, zones, energy }: { counts: Record<ZoneId, number>; zones: ZoneStates; energy: ClassroomEnergy }) {
  const occupancy = ZONES.map((zone) => ({ zone, students: counts[zone], lights: zones[zone].lightOn ? 1 : 0, fan: zones[zone].fanOn ? 1 : 0 }));
  const energyData = [
    { name: "Baseline", kWh: energy.baselineEnergyKwh },
    { name: "Optimized + control", kWh: energy.optimizedIncludingOverheadKwh },
  ];
  const runtime = ZONES.map((zone) => ({ zone, lights: zones[zone].lightHours, fan: zones[zone].fanHours }));
  const chartProps = { margin: { top: 6, right: 6, left: -24, bottom: 0 } };
  const tooltipStyle = { background: "#111d19", border: "1px solid #33443d", borderRadius: 8, fontSize: 10 };

  return <div className="space-y-3">
    <div className="grid grid-cols-2 gap-1.5 text-[9px]">
      <Metric label="Baseline energy" value={`${energy.baselineEnergyKwh.toFixed(3)} kWh`} />
      <Metric label="Optimized devices" value={`${energy.optimizedEnergyKwh.toFixed(3)} kWh`} />
      <Metric label="Controller overhead" value={`${energy.controllerOverheadKwh.toFixed(3)} kWh`} />
      <Metric label="Net saving" value={`${energy.netSavingsKwh.toFixed(3)} kWh`} tone={energy.netSavingsKwh < 0 ? "rose" : "emerald"} />
    </div>
    <div className="grid grid-cols-2 gap-1.5 text-[9px]">
      <Metric label="Gross saving" value={`${energy.grossSavingsKwh.toFixed(3)} kWh`} />
      <Metric label="Net energy saved" value={energy.savingsPercent === null ? "— (zero baseline)" : `${energy.savingsPercent.toFixed(1)}%`} tone={energy.savingsPercent !== null && energy.savingsPercent < 0 ? "rose" : "emerald"} />
      <Metric label="Baseline cost" value={`₹${energy.baselineCost.toFixed(2)}`} />
      <Metric label="Optimized cost" value={`₹${energy.optimizedCost.toFixed(2)}`} />
    </div>
    <div className="rounded-lg border border-white/[0.07] bg-black/15 p-2">
      <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/55">Occupancy by zone · simulated</p>
      <ResponsiveContainer width="100%" height={88}><BarChart data={occupancy} {...chartProps}><CartesianGrid stroke="#27352f" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="zone" tick={{ fill: "#aebbb4", fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} domain={[0, 6]} tick={{ fill: "#77877e", fontSize: 8 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} labelFormatter={(value) => `Zone ${value}`} /><Bar dataKey="students" name="Students" radius={[3, 3, 0, 0]}>{occupancy.map((entry) => <Cell key={entry.zone} fill={TONES[entry.zone]} />)}</Bar></BarChart></ResponsiveContainer>
    </div>
    <div className="rounded-lg border border-white/[0.07] bg-black/15 p-2">
      <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/55">Equivalent-period energy · simulated</p>
      <ResponsiveContainer width="100%" height={88}><BarChart data={energyData} {...chartProps}><CartesianGrid stroke="#27352f" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fill: "#aebbb4", fontSize: 8 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#77877e", fontSize: 8 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${Number(value).toFixed(4)} kWh`, "Energy"]} /><Bar dataKey="kWh" name="Energy" fill="#58D6A0" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer>
      <p className="mt-1 text-[8px] leading-3 text-white/40">Always-on installed-equipment baseline for the same elapsed simulated period; optimized energy includes controlled fixtures. Controller energy is included in optimized cost.</p>
    </div>
    <div className="rounded-lg border border-white/[0.07] bg-black/15 p-2">
      <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/55">Device runtime by zone · simulated hours</p>
      <ResponsiveContainer width="100%" height={84}><BarChart data={runtime} {...chartProps}><CartesianGrid stroke="#27352f" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="zone" tick={{ fill: "#aebbb4", fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#77877e", fontSize: 8 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${Number(value).toFixed(3)} h`]} /><Bar dataKey="lights" name="Lights" fill="#F6D885" radius={[3, 3, 0, 0]} /><Bar dataKey="fan" name="Fans" fill="#65BDE8" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer>
    </div>
    <p className="text-[8px] leading-3 text-white/40">Energy = rated power (W) × simulated operating hours / 1000. Net savings remain signed; tariff-based costs are estimates, not bills.</p>
  </div>;
}

function Metric({ label, value, tone = "normal" }: { label: string; value: string; tone?: "normal" | "emerald" | "rose" }) {
  return <div className="rounded-md bg-white/[0.035] p-1.5"><p className="text-white/40">{label}</p><p className={`mt-0.5 font-semibold ${tone === "emerald" ? "text-emerald-200" : tone === "rose" ? "text-rose-200" : "text-white/85"}`}>{value}</p></div>;
}
