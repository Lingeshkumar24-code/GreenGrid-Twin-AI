"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import ClassroomAnalytics from "@/components/ClassroomAnalytics";
import { advanceStudents, createStudentAgents, formatSimulationTime, occupancyByZone, pathSegmentAtTime, routeToSeat, totalOccupancy, ZONES, type StudentAgent, type ZoneId } from "@/lib/classroom-engine";
import { advanceZoneControls, createZoneStates, setZoneOverride, type DeviceEvent, type Override, type ZoneStates } from "@/lib/classroom-controls";
import { DEFAULT_CONTROLLER_W_PER_ZONE, DEFAULT_TARIFF_PER_KWH, energyFromRuntime } from "@/lib/classroom-energy";

const ZONE_TONES: Record<ZoneId, string> = { A: "#58D6A0", B: "#65BDE8", C: "#C4A4F2", D: "#F0B66B" };
const START_DEFAULT = 9 * 60;
const END_DEFAULT = 15 * 60 + 30;
const BREAK_START_DEFAULT = 10 * 60 + 30;
const BREAK_END_DEFAULT = 10 * 60 + 45;
const DEFAULT_SIZE = 6;
type TourFocus = "door" | "whiteboard" | "zone-a" | "light-a" | "fan-a" | null;

function StudentModel({ agent, running }: { agent: StudentAgent; running: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const target = useRef(new THREE.Vector3());
  const initialized = useRef(false);
  useFrame((_, delta) => {
    if (!ref.current) return;
    if (!initialized.current) { ref.current.position.set(agent.position[0], 0, agent.position[2]); initialized.current = true; }
    target.current.set(agent.position[0], 0, agent.position[2]);
    ref.current.position.lerp(target.current, 1 - Math.exp(-delta * 15));
    const walking = agent.phase === "entering" || agent.phase === "walking" || agent.phase === "leaving";
    ref.current.position.y = agent.phase === "sitting" ? -0.42 : walking && running ? Math.abs(Math.sin(performance.now() * 0.008 + agent.id)) * 0.035 : 0;
    if (walking && agent.route.length > 1) {
      const segment = pathSegmentAtTime(agent.route, agent.phaseSeconds);
      const next = agent.route[Math.min(segment + 1, agent.route.length - 1)];
      const dx = next[0] - agent.position[0], dz = next[2] - agent.position[2];
      if (Math.hypot(dx, dz) > 0.02) ref.current.rotation.y = Math.atan2(dx, dz);
    }
  });
  const color = ["#5B8C85", "#C08D68", "#6B789E", "#B97877", "#8C9B66", "#9B7CAD"][agent.id % 6];
  return <group ref={ref}>
    <mesh position={[0, 0.72, 0]} castShadow><capsuleGeometry args={[0.19, 0.48, 4, 8]} /><meshStandardMaterial color={color} roughness={0.8} /></mesh>
    <mesh position={[0, 1.2, 0]} castShadow><sphereGeometry args={[0.17, 12, 10]} /><meshStandardMaterial color="#D6B496" roughness={0.9} /></mesh>
    <mesh position={[-0.09, 0.22, 0]}><cylinderGeometry args={[0.055, 0.07, 0.42, 7]} /><meshStandardMaterial color="#394854" /></mesh>
    <mesh position={[0.09, 0.22, 0]}><cylinderGeometry args={[0.055, 0.07, 0.42, 7]} /><meshStandardMaterial color="#394854" /></mesh>
  </group>;
}

function Desk({ x, z }: { x: number; z: number }) {
  return <group position={[x, 0, z]}>
    <mesh position={[0, 0.76, 0]} castShadow receiveShadow><boxGeometry args={[1.48, 0.09, 0.66]} /><meshStandardMaterial color="#B9875D" roughness={0.68} /></mesh>
    {[[-0.62, -0.24], [0.62, -0.24], [-0.62, 0.24], [0.62, 0.24]].map(([x1, z1], i) => <mesh key={i} position={[x1, 0.37, z1]} castShadow><boxGeometry args={[0.055, 0.72, 0.055]} /><meshStandardMaterial color="#56615D" metalness={0.62} roughness={0.45} /></mesh>)}
    {[-0.43, 0.43].map((dx) => <group key={dx} position={[dx, 0, 0.77]}>
      <mesh position={[0, 0.48, -0.06]} castShadow><boxGeometry args={[0.4, 0.07, 0.4]} /><meshStandardMaterial color="#4A6B60" roughness={0.78} /></mesh>
      <mesh position={[0, 0.73, -0.23]} castShadow><boxGeometry args={[0.4, 0.48, 0.07]} /><meshStandardMaterial color="#4A6B60" roughness={0.78} /></mesh>
      <mesh position={[0, 0.23, -0.06]}><cylinderGeometry args={[0.025, 0.03, 0.43, 6]} /><meshStandardMaterial color="#68746F" metalness={0.6} /></mesh>
    </group>)}
  </group>;
}

function Fan({ zone, on }: { zone: ZoneId; on: boolean }) {
  const blades = useRef<THREE.Group>(null);
  useFrame((_, delta) => { if (blades.current && on) blades.current.rotation.y += delta * 2.2; });
  const x = [-5.05, -3.0, 3.0, 5.05][ZONES.indexOf(zone)];
  return <group position={[x, 2.93, -0.4]}>
    <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.09, 0.09, 0.25, 12]} /><meshStandardMaterial color="#84938D" metalness={0.6} roughness={0.35} /></mesh>
    <group ref={blades}>{[0, 1, 2, 3].map((i) => <mesh key={i} position={[Math.sin(i * Math.PI / 2) * 0.64, 0, Math.cos(i * Math.PI / 2) * 0.64]} rotation={[0, i * Math.PI / 2, 0]}><boxGeometry args={[0.19, 0.045, 1.18]} /><meshStandardMaterial color={on ? "#B8D7CB" : "#73817B"} roughness={0.45} /></mesh>)}</group>
    <Html position={[0, 0.5, 0]} center distanceFactor={12}><span className={`rounded px-1.5 py-0.5 text-[9px] ${on ? "bg-emerald-950/80 text-emerald-200" : "bg-black/60 text-white/45"}`}>FAN {zone} · {on ? "ON" : "OFF"}</span></Html>
  </group>;
}

const TOUR_POSES: Record<Exclude<TourFocus, null>, { position: [number, number, number]; target: [number, number, number] }> = {
  door: { position: [0, 4.2, 8.8], target: [0, 1.1, 3.4] },
  whiteboard: { position: [0, 5.2, -1.3], target: [0, 1.8, -5.7] },
  "zone-a": { position: [-8.7, 7.2, 5.1], target: [-5.05, 0.8, -0.2] },
  "light-a": { position: [-7.4, 5.2, -0.8], target: [-5.05, 3.05, -1.35] },
  "fan-a": { position: [-7.7, 5, 1.4], target: [-5.05, 3, -0.4] },
};

function ClassroomCameraRig({ view, resetKey, tourFocus, onManualControl }: { view: "iso" | "top"; resetKey: number; tourFocus: TourFocus; onManualControl?: () => void }) {
  const controls = useRef<any>(null);
  const { camera } = useThree();
  const focus = useRef(new THREE.Vector3(0, 0.6, 0));
  const desiredPosition = useRef(new THREE.Vector3());
  const desiredFocus = useRef(new THREE.Vector3());
  useEffect(() => {
    if (view === "top") { camera.position.set(0, 15.5, 0.01); camera.up.set(0, 0, -1); }
    else { camera.position.set(12, 10.5, 14); camera.up.set(0, 1, 0); }
    camera.lookAt(0, 0.6, 0); controls.current?.target.set(0, 0.6, 0); controls.current?.update();
  }, [view, resetKey, camera]);
  useFrame((_, delta) => {
    if (!tourFocus) return;
    const pose = TOUR_POSES[tourFocus];
    desiredPosition.current.set(...pose.position);
    desiredFocus.current.set(...pose.target);
    const alpha = 1 - Math.exp(-delta * 1.5);
    camera.position.lerp(desiredPosition.current, alpha);
    focus.current.lerp(desiredFocus.current, alpha);
    camera.up.set(0, 1, 0);
    camera.lookAt(focus.current);
    if (controls.current) { controls.current.target.copy(focus.current); controls.current.update(); }
  });
  return <OrbitControls ref={controls} makeDefault onStart={onManualControl} enableDamping dampingFactor={0.08} enablePan enableRotate minDistance={7} maxDistance={29} minPolarAngle={0.08} maxPolarAngle={Math.PI / 2.04} target={[0, 0.6, 0]} />;
}

function ClassroomScene({ agents, zones, ceilingOff, view, resetKey, running, tourFocus, onManualControl }: { agents: StudentAgent[]; zones: ZoneStates; ceilingOff: boolean; view: "iso" | "top"; resetKey: number; running: boolean; tourFocus: TourFocus; onManualControl?: () => void }) {
  const lights = useMemo(() => ZONES.flatMap((zone) => {
    const x = [-5.05, -3.0, 3.0, 5.05][ZONES.indexOf(zone)];
    return [-1.35, 1.35].map((z) => ({ zone, x, z }));
  }), []);
  const presentByZone = useMemo(() => occupancyByZone(agents), [agents]);
  return <>
    <color attach="background" args={["#101a18"]} /><fog attach="fog" args={["#101a18", 24, 52]} />
    <ambientLight intensity={0.65} /><hemisphereLight args={["#e5f0ea", "#554536", 0.65]} />
    <directionalLight position={[-5, 12, 5]} intensity={1.25} castShadow shadow-mapSize={[1536, 1536]} shadow-camera-left={-11} shadow-camera-right={11} shadow-camera-top={11} shadow-camera-bottom={-11} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow><planeGeometry args={[14, 12]} /><meshStandardMaterial color="#C9C3B6" roughness={0.88} /></mesh>
    <mesh position={[0, 0.005, 0]}><planeGeometry args={[13.5, 11.5]} /><meshStandardMaterial color="#AEB8AD" roughness={0.94} /></mesh>
    {[[-7, 1.6, 0, 0.16, 3.2, 12], [7, 1.6, 0, 0.16, 3.2, 12], [0, 1.6, -6, 14, 3.2, 0.16], [-4.25, 1.6, 6, 5.5, 3.2, 0.16], [4.25, 1.6, 6, 5.5, 3.2, 0.16], [0, 2.75, 6, 3, 0.9, 0.16]].map(([x, y, z, w, h, d], i) => <mesh key={i} position={[x, y, z]} castShadow receiveShadow><boxGeometry args={[w, h, d]} /><meshStandardMaterial color={i < 2 ? "#D6D4C8" : "#E6E3D8"} roughness={0.82} /></mesh>)}
    <group position={[1.45, 0, 5.92]} rotation={[0, -Math.PI / 2, 0]}><mesh position={[-0.62, 1.12, 0]} castShadow><boxGeometry args={[1.24, 2.24, 0.09]} /><meshStandardMaterial color="#805D43" roughness={0.68} /></mesh><mesh position={[-1.08, 1.08, 0.07]}><sphereGeometry args={[0.045, 10, 8]} /><meshStandardMaterial color="#D6B56F" metalness={0.72} roughness={0.28} /></mesh></group>
    {[-4.3, -1.5, 1.5, 4.3].map((z, i) => <group key={i}>{[-7, 7].map((x) => <mesh key={x} position={[x, 1.95, z]} castShadow><boxGeometry args={[0.13, 1.45, 1.7]} /><meshStandardMaterial color="#A4C7C7" emissive="#79A8A7" emissiveIntensity={0.08} roughness={0.25} metalness={0.18} /></mesh>)}{[-7, 7].map((x) => <mesh key={`sill${x}`} position={[x, 1.16, z]}><boxGeometry args={[0.24, 0.1, 1.84]} /><meshStandardMaterial color="#D8D2C4" roughness={0.7} /></mesh>)}</group>)}
    <mesh position={[0, 1.96, -5.84]}><boxGeometry args={[4.2, 1.25, 0.07]} /><meshStandardMaterial color="#F3F4ED" roughness={0.35} metalness={0.06} /></mesh>
    <mesh position={[0, 1.96, -5.78]}><boxGeometry args={[3.92, 0.99, 0.025]} /><meshStandardMaterial color="#F9FAF4" roughness={0.3} /></mesh>
    <mesh position={[0, 0.89, -5.66]} castShadow><boxGeometry args={[2.9, 0.08, 0.36]} /><meshStandardMaterial color="#806344" roughness={0.72} /></mesh>
    <mesh position={[0, 3.21, 0]} visible={!ceilingOff} receiveShadow><boxGeometry args={[14, 0.12, 12]} /><meshStandardMaterial color="#F3F1E8" side={THREE.DoubleSide} roughness={0.95} /></mesh>
    {lights.map(({ zone, x, z }, i) => <group key={i} position={[x, 3.08, z]}><mesh><boxGeometry args={[1.55, 0.07, 0.32]} /><meshStandardMaterial color={zones[zone].lightOn ? "#FFF5D7" : "#68716E"} emissive={zones[zone].lightOn ? "#FFE8A3" : "#000000"} emissiveIntensity={zones[zone].lightOn ? 1.2 : 0} roughness={0.28} /></mesh>{zones[zone].lightOn && <pointLight position={[0, -0.24, 0]} color="#FFE8BB" intensity={4.1} distance={5.3} decay={1.8} />}</group>)}
    {ZONES.map((zone) => <Fan key={zone} zone={zone} on={zones[zone].fanOn} />)}
    {[-5.05, -3.0, 3.0, 5.05].map((x, i) => [-2.2, -0.05, 2.1].map((z) => <Desk key={`${i}-${z}`} x={x} z={z} />))}
    {ZONES.map((zone) => {
      const x = [-5.05, -3.0, 3.0, 5.05][ZONES.indexOf(zone)];
      return <group key={zone}><mesh position={[x, 0.018, 0]}><planeGeometry args={[1.75, 10.5]} /><meshBasicMaterial color={ZONE_TONES[zone]} transparent opacity={zones[zone].confirmed ? 0.055 : 0.025} depthWrite={false} /></mesh><Html position={[x, 0.08, -5.1]} center distanceFactor={12}><div className="whitespace-nowrap rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider shadow-lg" style={{ borderColor: `${ZONE_TONES[zone]}70`, color: ZONE_TONES[zone], background: "#10211de8" }}>Zone {zone} · {presentByZone[zone]} present</div></Html></group>;
    })}
    {agents.filter((agent) => agent.phase !== "outside").map((agent) => <StudentModel key={agent.id} agent={agent} running={running} />)}
    <Html position={[0, 2.83, 5.6]} center distanceFactor={11}><div className="rounded border border-amber-200/30 bg-amber-950/80 px-2 py-1 text-[9px] font-semibold tracking-wider text-amber-100">MAIN ENTRY · IN / OUT</div></Html>
    <ClassroomCameraRig view={view} resetKey={resetKey} tourFocus={tourFocus} onManualControl={onManualControl} />
  </>;
}

function timeValue(minutes: number): string { return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`; }
function parseTime(value: string): number { const [hours, minutes] = value.split(":").map(Number); return hours * 60 + minutes; }

export default function ClassroomInterior({ onClose, tourFocus = null, onManualControl }: { onClose: () => void; tourFocus?: TourFocus; onManualControl?: () => void }) {
  const [agents, setAgents] = useState<StudentAgent[]>(createStudentAgents);
  const [zones, setZones] = useState<ZoneStates>(createZoneStates);
  const [classSize, setClassSize] = useState(DEFAULT_SIZE);
  const [arrival, setArrival] = useState(START_DEFAULT);
  const [departure, setDeparture] = useState(END_DEFAULT);
  const [breakStart, setBreakStart] = useState(BREAK_START_DEFAULT);
  const [breakEnd, setBreakEnd] = useState(BREAK_END_DEFAULT);
  const [minutes, setMinutes] = useState(8 * 60 + 54);
  const [speed, setSpeed] = useState(60);
  const [running, setRunning] = useState(true);
  const [ceilingOff, setCeilingOff] = useState(true);
  const [view, setView] = useState<"iso" | "top">("iso");
  const [resetKey, setResetKey] = useState(0);
  const [events, setEvents] = useState<DeviceEvent[]>([]);
  const [elapsedHours, setElapsedHours] = useState(0);
  const [tariff, setTariff] = useState(DEFAULT_TARIFF_PER_KWH);
  const [controllerWatts, setControllerWatts] = useState(DEFAULT_CONTROLLER_W_PER_ZONE);
  const currentMinutes = useRef(minutes);
  const currentAgents = useRef(agents);
  const currentZones = useRef(zones);
  const elapsedHoursRef = useRef(0);
  useEffect(() => { currentMinutes.current = minutes; }, [minutes]);
  useEffect(() => { currentAgents.current = agents; }, [agents]);
  useEffect(() => { currentZones.current = zones; }, [zones]);

  const zoneCounts = useMemo(() => occupancyByZone(agents), [agents]);
  const occupied = useMemo(() => totalOccupancy(agents), [agents]);
  const occupiedZones = ZONES.filter((zone) => zoneCounts[zone] > 0).length;
  const energy = useMemo(() => energyFromRuntime(zones, elapsedHours, controllerWatts, tariff), [zones, elapsedHours, controllerWatts, tariff]);

  useEffect(() => {
    let raf = 0;
    let lastStep = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!running || now - lastStep < 80) return;
      const dt = Math.min((now - lastStep) / 1000, 0.2);
      lastStep = now;
      const simMinutes = (currentMinutes.current + dt * speed / 60) % 1440;
      currentMinutes.current = simMinutes;
      setMinutes(simMinutes);
      elapsedHoursRef.current += dt * speed / 3600;
      setElapsedHours(elapsedHoursRef.current);
      const nextAgents = advanceStudents(currentAgents.current, { classSize, nowMinutes: simMinutes, startMinutes: arrival, endMinutes: departure, breakStartMinutes: breakStart, breakEndMinutes: breakEnd }, dt);
      currentAgents.current = nextAgents;
      setAgents(nextAgents);
      const nextOccupancy = occupancyByZone(nextAgents);
      const automation = advanceZoneControls(currentZones.current, nextOccupancy, dt, speed, formatSimulationTime(simMinutes));
      currentZones.current = automation.zones;
      setZones(automation.zones);
      if (automation.events.length) setEvents((old) => [...automation.events, ...old].slice(0, 100));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed, classSize, arrival, departure, breakStart, breakEnd]);

  const reset = useCallback(() => {
    const resetMinute = (arrival - 6 + 1440) % 1440;
    currentMinutes.current = resetMinute;
    setMinutes(resetMinute);
    elapsedHoursRef.current = 0;
    setElapsedHours(0);
    const freshAgents = createStudentAgents();
    currentAgents.current = freshAgents;
    setAgents(freshAgents);
    const freshZones = createZoneStates();
    currentZones.current = freshZones;
    setZones(freshZones);
    setEvents([]);
    setRunning(true);
    setResetKey((key) => key + 1);
  }, [arrival]);

  return <section className="absolute inset-0 z-30 overflow-hidden bg-[#0d1513] text-white">
    <Canvas shadows camera={{ position: [12, 10.5, 14], fov: 47 }} dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: "high-performance" }}>
      <ClassroomScene agents={agents} zones={zones} ceilingOff={ceilingOff} view={view} resetKey={resetKey} running={running} tourFocus={tourFocus} onManualControl={onManualControl} />
    </Canvas>
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 bg-gradient-to-b from-[#0d1513]/95 to-transparent p-4">
      <div className="pointer-events-auto"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-300" /><p className="text-[10px] font-semibold uppercase tracking-[0.23em] text-emerald-200">Academic Block A · Interior Twin</p><span className="rounded-full bg-cyan-200/10 px-2 py-0.5 text-[8px] font-bold text-cyan-100">SIMULATED</span></div><h1 className="mt-1 text-xl font-semibold tracking-tight">Learning studio · 14 × 12 m</h1><p className="mt-1 text-[11px] text-white/55">Procedural room · no occupancy sensors connected</p></div>
      <div className="pointer-events-auto flex flex-wrap justify-end gap-1.5">{(["iso", "top"] as const).map((mode) => <button key={mode} onClick={() => setView(mode)} className={`rounded-md border px-2.5 py-1.5 text-[10px] ${view === mode ? "border-emerald-300/45 bg-emerald-300/15 text-emerald-100" : "border-white/10 bg-black/40 text-white/70"}`}>{mode === "iso" ? "Isometric" : "Top-down"}</button>)}<button onClick={() => setCeilingOff((value) => !value)} className="rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 text-[10px] text-white/80">Ceiling {ceilingOff ? "off" : "on"}</button><button onClick={() => { setView("iso"); setResetKey((key) => key + 1); }} className="rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 text-[10px] text-white/80">Reset camera</button><button onClick={onClose} className="rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 text-[10px] text-white/80">← Campus</button></div>
    </header>
    <div className="pointer-events-none absolute bottom-4 left-4 right-4 top-[88px] z-10 flex items-end justify-between gap-3">
      <aside className="pointer-events-auto max-h-[calc(100%-8px)] w-[min(344px,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-white/10 bg-[#101b18]/95 p-3 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between"><div><p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-300">Deterministic class day · SIMULATED</p><p className="mt-1 text-xs text-white/65">{formatSimulationTime(minutes)} · {speed}× sim speed</p></div><span className={`rounded-full px-2 py-1 text-[9px] ${running ? "bg-emerald-300/10 text-emerald-200" : "bg-amber-200/10 text-amber-100"}`}>{running ? "RUNNING" : "PAUSED"}</span></div>
        <div className="mt-3 grid grid-cols-3 gap-1.5 text-center"><div className="rounded-lg bg-white/[0.04] p-2"><b className="text-base text-white">{occupied}</b><p className="text-[9px] text-white/45">in room</p></div><div className="rounded-lg bg-white/[0.04] p-2"><b className="text-base text-white">{occupiedZones}/4</b><p className="text-[9px] text-white/45">zones occupied</p></div><div className="rounded-lg bg-white/[0.04] p-2"><b className="text-base text-white">{energy.currentPowerW} W</b><p className="text-[9px] text-white/45">controlled load</p></div></div>
        <div className="mt-3 flex gap-1.5"><button onClick={() => setRunning((value) => !value)} className="flex-1 rounded-md bg-emerald-300 px-2 py-2 text-[10px] font-semibold text-emerald-950">{running ? "Ⅱ Pause" : "▶ Resume"}</button><button onClick={reset} className="rounded-md border border-white/10 px-3 py-2 text-[10px] text-white/80">Reset day</button><select value={speed} aria-label="Simulation speed" onChange={(event) => setSpeed(Number(event.target.value))} className="rounded-md border border-white/10 bg-[#17221e] px-2 py-2 text-[10px] text-white"><option value={1}>1×</option><option value={10}>10×</option><option value={60}>60×</option></select></div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><label className="text-white/60">Students <span className="float-right text-white">{classSize}/24</span><input type="range" min="0" max="24" value={classSize} onChange={(event) => setClassSize(Number(event.target.value))} className="mt-1 w-full accent-emerald-300" /></label><label className="text-white/60">Class start<input aria-label="Class start" type="time" value={timeValue(arrival)} onChange={(event) => setArrival(parseTime(event.target.value))} className="mt-1 w-full rounded border border-white/10 bg-[#17221e] px-2 py-1 text-white" /></label><label className="text-white/60">Class end<input aria-label="Class end" type="time" value={timeValue(departure)} onChange={(event) => setDeparture(parseTime(event.target.value))} className="mt-1 w-full rounded border border-white/10 bg-[#17221e] px-2 py-1 text-white" /></label><div className="text-white/60">Break <div className="mt-1 flex items-center gap-1"><input aria-label="Break start" type="time" value={timeValue(breakStart)} onChange={(event) => setBreakStart(parseTime(event.target.value))} className="min-w-0 w-full rounded border border-white/10 bg-[#17221e] px-1 py-1 text-white" /><input aria-label="Break end" type="time" value={timeValue(breakEnd)} onChange={(event) => setBreakEnd(parseTime(event.target.value))} className="min-w-0 w-full rounded border border-white/10 bg-[#17221e] px-1 py-1 text-white" /></div></div></div>
        <div className="mt-3 border-t border-white/10 pt-3"><div className="flex items-center justify-between"><p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/65">Zone devices</p><span className="text-[9px] text-emerald-200">{energy.optimizedIncludingOverheadKwh.toFixed(3)} kWh incl. overhead</span></div>
          <div className="mt-2 space-y-2">{ZONES.map((zone) => <div key={zone} className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-2"><div className="flex items-center justify-between"><span className="text-[10px] font-semibold" style={{ color: ZONE_TONES[zone] }}>ZONE {zone} <span className="font-normal text-white/45">· {zoneCounts[zone]} present</span></span><span className="text-[9px] text-white/45">{zoneCounts[zone] > 0 ? "occupied" : zones[zone].lightOn && zones[zone].lights === "auto" ? `${Math.ceil(Math.max(0, zones[zone].vacancyTimeout * 60 - zones[zone].vacancySeconds) / 60)}m to lights off` : "vacant"}</span></div>
            <div className="mt-1.5 grid grid-cols-2 gap-2">{(["lights", "fan"] as const).map((device) => <label key={device} className="flex items-center justify-between gap-1 text-[9px] text-white/55"><span>{device === "lights" ? `Lights · ${zones[zone].lightOn ? "ON" : "OFF"}` : `Fan · ${zones[zone].fanOn ? "ON" : "OFF"}`}</span><select value={zones[zone][device]} onChange={(event) => setZones((current) => setZoneOverride(current, zone, device, event.target.value as Override))} aria-label={`Zone ${zone} ${device} control`} className="rounded border border-white/10 bg-[#17221e] px-1.5 py-1 text-[9px] text-white"><option value="auto">Auto</option><option value="on">Force on</option><option value="off">Force off</option></select></label>)}</div>
            <label className="mt-1 flex items-center justify-between text-[9px] text-white/45">Fan rating<select value={zones[zone].fanWatts} aria-label={`Zone ${zone} fan power rating`} onChange={(event) => setZones((current) => ({ ...current, [zone]: { ...current[zone], fanWatts: Number(event.target.value) } }))} className="rounded border border-white/10 bg-[#17221e] px-1.5 py-1 text-[9px] text-white">{[40, 50, 62, 75, 90, 110, 130, 150].map((watts) => <option key={watts} value={watts}>{watts} W</option>)}</select></label>
            <div className="mt-1 text-[9px] text-white/40">Runtime · lights {zones[zone].lightHours.toFixed(2)} h / fan {zones[zone].fanHours.toFixed(2)} h</div>
            <label className="mt-1 flex items-center justify-between text-[9px] text-white/45">Vacancy delay (min)<input type="number" min="1" max="120" value={zones[zone].vacancyTimeout} onChange={(event) => { const value = Math.max(1, Math.min(120, Number(event.target.value) || 1)); setZones((current) => ({ ...current, [zone]: { ...current[zone], vacancyTimeout: value } })); }} className="w-16 rounded border border-white/10 bg-[#17221e] px-1.5 py-1 text-right text-[9px] text-white" /></label>
          </div>)}</div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-2"><label className="text-[9px] text-white/55">Tariff (₹/kWh)<input aria-label="Electricity tariff per kWh" type="number" min="0" step="0.5" value={tariff} onChange={(event) => setTariff(Math.max(0, Number(event.target.value) || 0))} className="mt-1 w-full rounded border border-white/10 bg-[#17221e] px-2 py-1 text-white" /></label><label className="text-[9px] text-white/55">Controller W / zone<input aria-label="Controller watts per zone" type="number" min="0" step="0.5" value={controllerWatts} onChange={(event) => setControllerWatts(Math.max(0, Number(event.target.value) || 0))} className="mt-1 w-full rounded border border-white/10 bg-[#17221e] px-2 py-1 text-white" /></label></div>
          <p className="mt-2 text-[9px] leading-4 text-white/40">Auto lights: 2 × 38 W/zone; fan rating is independently configurable. Occupancy confirmation and vacancy control are simulated. Lights require 2 s confirmation; fans follow confirmed occupancy. No temperature or ventilation sensor inputs are used.</p>
        </div>
      </aside>
      <aside className="pointer-events-auto hidden max-h-[calc(100%-8px)] w-[min(310px,30vw)] overflow-y-auto rounded-xl border border-white/10 bg-[#101b18]/95 p-3 shadow-xl backdrop-blur-xl xl:block"><p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.17em] text-white/60">Classroom energy & occupancy · SIMULATED</p><ClassroomAnalytics counts={zoneCounts} zones={zones} energy={energy} /><div className="mt-3 border-t border-white/10 pt-2"><p className="text-[9px] font-semibold uppercase tracking-[0.17em] text-white/60">Recent device transitions</p>{events.length === 0 ? <p className="mt-2 text-[10px] text-white/40">No transitions yet — zones switch independently as students arrive.</p> : <div className="mt-2 max-h-32 space-y-1.5 overflow-y-auto">{events.slice(0, 8).map((event) => <div key={event.id} className="flex items-start justify-between gap-2 text-[9px]"><span className="text-white/50">{event.time} · Z{event.zone} {event.device}<span className="block text-white/35">{event.reason}</span></span><b className={event.state === "ON" ? "text-emerald-200" : "text-white/55"}>{event.state}</b></div>)}</div>}</div><div className="mt-3 border-t border-white/10 pt-2 text-[9px] leading-4 text-white/45">Orbit · zoom · pan · top-down · isometric · reset<br />Ceiling-off reveals equipment and occupants</div></aside>
    </div>
  </section>;
}
