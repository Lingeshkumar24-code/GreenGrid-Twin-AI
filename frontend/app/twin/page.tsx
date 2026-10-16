"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { fetchCampus } from "@/lib/api";
import type { Building, Campus } from "@/lib/types";
import BuildingDetailPanel from "@/components/BuildingDetailPanel";
import AssistantPanel from "@/components/AssistantPanel";
import SimulationPanel from "@/components/SimulationPanel";
import OptimizationPanel from "@/components/OptimizationPanel";
import CostSavingsDashboard from "@/components/CostSavingsDashboard";

const ClassroomInterior = dynamic(() => import("@/components/ClassroomInterior"), { ssr: false });
import { getSimulationSnapshot } from "@/lib/simulation";

const CampusScene = dynamic(() => import("@/components/CampusScene"), { ssr: false });
const TOUR_STEPS = [
  { title: "Explore the living campus", body: "This is a real-time-ready 3D twin. Drag to orbit, scroll to zoom, and use the campus paths to orient yourself." },
  { title: "Inspect building health", body: "Select any building to fly the camera to it and review power, occupancy, water, and sustainability indicators." },
  { title: "Read the energy story", body: "Status colors highlight attention areas. Blue roof panels identify buildings with solar generation." },
];
const SYSTEM_STOPS = [
  { id: "classroom", title: "Classroom occupancy", focus: [0, 3, -28] as [number, number, number] },
  { id: "solar", title: "Solar generation", focus: [31, 12, -27] as [number, number, number] },
  { id: "wind", title: "Wind generation", focus: [34, 5, -5] as [number, number, number] },
  { id: "traffic", title: "EV and vehicle emissions", focus: [0, 2, 31] as [number, number, number] },
  { id: "biogas", title: "Hostel food waste to biogas", focus: [31, 4, 17] as [number, number, number] },
];

export default function DigitalTwinPage() {
  const [campus, setCampus] = useState<Campus | null>(null); const [error, setError] = useState<string | null>(null); const [selectedId, setSelectedId] = useState<string | null>(null); const [tourStep, setTourStep] = useState<number | null>(0); const [simHour, setSimHour] = useState(9); const [demoRunning, setDemoRunning] = useState(false); const [demoStage, setDemoStage] = useState(0); const [showOptimization, setShowOptimization] = useState(false); const [showCostDashboard, setShowCostDashboard] = useState(false); const [showClassroom, setShowClassroom] = useState(false);
  useEffect(() => { fetchCampus().then(setCampus).catch((e: Error) => setError(e.message)); }, []);
  useEffect(() => { const timer = window.setInterval(() => setSimHour((current) => (current + 0.05) % 24), 1000); return () => window.clearInterval(timer); }, []);
  const demoSequence = useMemo(() => [...(campus?.buildings.map((building) => ({ id: building.id, title: building.name, focus: [building.position[0], building.footprint[1] / 2, building.position[2]] as [number, number, number] })) ?? []), ...SYSTEM_STOPS], [campus]);
  useEffect(() => { if (!demoRunning || demoSequence.length === 0) return; const timer = window.setInterval(() => setDemoStage((stage) => (stage + 1) % demoSequence.length), 4000); return () => window.clearInterval(timer); }, [demoRunning, demoSequence.length]);
  const selected: Building | null = useMemo(() => campus?.buildings.find((b) => b.id === selectedId) ?? null, [campus, selectedId]);
  const currentTour = tourStep === null ? null : TOUR_STEPS[tourStep]; const currentStep = tourStep ?? 0;
  const simulation = useMemo(() => getSimulationSnapshot(simHour), [simHour]);
  const currentDemo = demoSequence[demoStage] ?? null;
  return <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden">
    {error && <div className="absolute inset-x-0 top-0 z-40 bg-rose-500/90 px-4 py-2 text-center text-sm text-white">Could not reach the backend ({error}). Start the FastAPI server to see the campus.</div>}
    {campus && <CampusScene buildings={campus.buildings} selectedId={selectedId} demoRunning={demoRunning} demoFocus={demoRunning ? currentDemo?.focus ?? null : null} onSelect={(b) => { setSelectedId(b.id); setTourStep(null); }} />}
    <SimulationPanel snapshot={simulation} />
    {showClassroom && <ClassroomInterior onClose={() => setShowClassroom(false)} onManualControl={() => setTourStep(null)} />}
    {showOptimization && <OptimizationPanel snapshot={simulation} onClose={() => setShowOptimization(false)} />}
    {showCostDashboard && <CostSavingsDashboard snapshot={simulation} onClose={() => setShowCostDashboard(false)} />}
    <div className="pointer-events-auto absolute right-4 top-4 z-20 flex flex-wrap justify-end gap-2"><button onClick={() => { setShowClassroom(true); setTourStep(null); setDemoRunning(false); }} className="rounded-lg border border-violet-200/25 bg-[#29213A]/95 px-3 py-2 text-xs font-semibold text-violet-100 shadow-xl backdrop-blur-xl">Classroom interior</button><button onClick={() => { setDemoRunning((running) => !running); setDemoStage(0); setSelectedId(null); setTourStep(null); }} className={`rounded-lg border px-3 py-2 text-xs font-semibold shadow-xl backdrop-blur-xl ${demoRunning ? "border-amber-300/40 bg-amber-300 text-amber-950" : "border-emerald-300/30 bg-[#10211c]/95 text-emerald-200"}`}>{demoRunning ? "Stop full demo" : "▶ Play full demo"}</button><button onClick={() => setShowOptimization((visible) => !visible)} className="rounded-lg border border-cyan-200/25 bg-[#12302c]/95 px-3 py-2 text-xs font-semibold text-cyan-100 shadow-xl backdrop-blur-xl">Energy optimized</button><button onClick={() => setShowCostDashboard((visible) => !visible)} className="rounded-lg border border-amber-200/25 bg-[#3A2C18]/95 px-3 py-2 text-xs font-semibold text-amber-100 shadow-xl backdrop-blur-xl">₹ Cost graph</button><button onClick={() => document.documentElement.requestFullscreen?.()} className="rounded-lg border border-white/10 bg-charcoal-900/90 px-3 py-2 text-xs text-ink-200 shadow-xl backdrop-blur-xl">Fullscreen</button><button onClick={() => setSelectedId(null)} className="rounded-lg border border-white/10 bg-charcoal-900/90 px-3 py-2 text-xs text-ink-200 shadow-xl backdrop-blur-xl">Fit campus</button></div>
    {demoRunning && currentDemo && <div className="pointer-events-none absolute bottom-20 left-1/2 z-20 -translate-x-1/2 rounded-full border border-amber-200/20 bg-charcoal-900/90 px-4 py-2 text-xs text-amber-100 shadow-xl backdrop-blur-xl">Demo stop {demoStage + 1}/{demoSequence.length} · {currentDemo.title}</div>}
    <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-lg border border-white/10 bg-charcoal-900/80 px-3 py-2 text-xs text-ink-300 backdrop-blur-sm">Drag to orbit · Scroll to zoom · Click a building to inspect it</div>
    <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex gap-3 rounded-lg border border-white/10 bg-charcoal-900/80 px-3 py-2 text-xs text-ink-300 backdrop-blur-sm"><LegendDot color="#34D399" label="Nominal" /><LegendDot color="#F5A524" label="Advisory" /><LegendDot color="#F2545B" label="Critical" /><LegendDot color="#38BDF8" label="Solar roof" /></div>
    {selectedId && <button onClick={() => setSelectedId(null)} className="absolute right-4 top-16 z-20 rounded-lg border border-white/10 bg-charcoal-900/80 px-3 py-1.5 text-xs text-ink-100 backdrop-blur-sm hover:bg-charcoal-800">Return to campus view</button>}
    {selected && <BuildingDetailPanel building={selected} onClose={() => setSelectedId(null)} />}
    <AssistantPanel />
    {currentTour && <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/25 p-6 backdrop-blur-[2px]"><div className="w-full max-w-md rounded-2xl border border-emerald-200/15 bg-[#10211c]/95 p-6 shadow-2xl shadow-black/40"><div className="mb-4 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-300">Digital twin tour · {currentStep + 1}/{TOUR_STEPS.length}</span><button onClick={() => setTourStep(null)} className="text-xs text-ink-400 hover:text-white">Skip</button></div><h2 className="font-display text-2xl font-semibold text-white">{currentTour.title}</h2><p className="mt-3 text-sm leading-6 text-ink-300">{currentTour.body}</p><div className="mt-6 flex items-center justify-between"><div className="flex gap-1.5">{TOUR_STEPS.map((_, index) => <span key={index} className={`h-1.5 w-7 rounded-full ${index === currentStep ? "bg-emerald-300" : "bg-white/15"}`} />)}</div><button onClick={() => setTourStep(currentStep === TOUR_STEPS.length - 1 ? null : currentStep + 1)} className="rounded-lg bg-emerald-300 px-4 py-2 text-xs font-semibold text-emerald-950 hover:bg-emerald-200">{currentStep === TOUR_STEPS.length - 1 ? "Start exploring" : "Next"}</button></div></div></div>}
    {!currentTour && <button onClick={() => setTourStep(0)} className="absolute right-4 bottom-4 z-10 rounded-lg border border-white/10 bg-charcoal-900/80 px-3 py-1.5 text-xs text-ink-200 backdrop-blur-sm hover:bg-charcoal-800">Replay tour</button>}
  </div>;
}
function LegendDot({ color, label }: { color: string; label: string }) { return <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}</span>; }
