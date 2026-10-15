"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Html, OrbitControls } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Building } from "@/lib/types";

const STATUS_COLOR: Record<string, string> = {
  nominal: "#34D399",
  advisory: "#F5A524",
  critical: "#F2545B",
  renewable: "#38BDF8",
};

const BUILDING_MATERIALS: Record<string, string> = {
  academic: "#36566B",
  hostel: "#5E526A",
  laboratory: "#3F6266",
  library: "#74624A",
  cafeteria: "#69513E",
  administration: "#4D5F70",
};

function WindowBand({ width, height, depth, floors }: { width: number; height: number; depth: number; floors: number }) {
  const rows = Math.max(1, Math.min(floors, 6));
  const columns = Math.max(2, Math.floor(width / 2));
  const windows = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = -width / 2 + 1.15 + column * ((width - 2.3) / Math.max(columns - 1, 1));
      const y = 1.25 + row * (height / Math.max(rows, 1));
      windows.push(
        <mesh key={`${row}-${column}`} position={[x, y, depth / 2 + 0.035]}>
          <boxGeometry args={[0.72, Math.min(1.05, height / rows * 0.48), 0.05]} />
          <meshStandardMaterial color="#A8D9D2" emissive="#4E8D87" emissiveIntensity={0.16} roughness={0.22} metalness={0.3} />
        </mesh>,
      );
    }
  }
  return <group>{windows}</group>;
}

function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.22, 1.8, 8]} />
        <meshStandardMaterial color="#6B4931" roughness={0.95} />
      </mesh>
      <mesh position={[0, 2.05, 0]} castShadow>
        <sphereGeometry args={[1.05, 12, 8]} />
        <meshStandardMaterial color="#2A7658" roughness={0.9} />
      </mesh>
      <mesh position={[0.45, 2.35, 0.2]} castShadow>
        <sphereGeometry args={[0.65, 10, 7]} />
        <meshStandardMaterial color="#3B9667" roughness={0.9} />
      </mesh>
    </group>
  );
}

function LampPost({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.07, 3, 8]} />
        <meshStandardMaterial color="#253C3B" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 3.05, 0]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#D5F5D8" emissive="#8CF5B6" emissiveIntensity={1.5} />
      </mesh>
    </group>
  );
}

function BuildingMesh({ building, isSelected, onSelect }: { building: Building; isSelected: boolean; onSelect: (b: Building) => void }) {
  const [hovered, setHovered] = useState(false);
  const [w, h, d] = building.footprint;
  const [x, , z] = building.position;
  const color = STATUS_COLOR[building.status] ?? "#9CA3AF";
  const facade = BUILDING_MATERIALS[building.type] ?? "#4C6470";
  const roofHeight = Math.max(0.28, Math.min(0.65, h * 0.045));

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(building); }} onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }} onPointerOut={() => { setHovered(false); document.body.style.cursor = "auto"; }}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={facade} roughness={0.7} metalness={0.12} emissive={isSelected ? color : "#000000"} emissiveIntensity={isSelected ? 0.22 : 0} />
      </mesh>
      <mesh position={[0, h + roofHeight / 2, 0]} castShadow>
        <boxGeometry args={[w + 0.32, roofHeight, d + 0.32]} />
        <meshStandardMaterial color="#263D42" roughness={0.58} metalness={0.25} />
      </mesh>
      <WindowBand width={w} height={h} depth={d} floors={building.floors} />
      <mesh position={[0, Math.min(2.4, h * 0.24), d / 2 + 0.12]}>
        <boxGeometry args={[Math.min(5, w * 0.55), Math.min(1.35, h * 0.14), 0.08]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.22} roughness={0.45} />
      </mesh>
      {building.has_solar && (
        <group position={[0, h + roofHeight + 0.2, 0]}>
          <mesh rotation={[-0.12, 0, 0]} castShadow>
            <boxGeometry args={[w * 0.78, 0.12, d * 0.72]} />
            <meshStandardMaterial color="#163D5B" roughness={0.22} metalness={0.72} />
          </mesh>
          <mesh position={[0, 0.08, 0]} rotation={[-0.12, 0, 0]}>
            <boxGeometry args={[w * 0.7, 0.02, d * 0.64]} />
            <meshStandardMaterial color="#55A9D8" emissive="#1B5677" emissiveIntensity={0.25} roughness={0.18} metalness={0.82} />
          </mesh>
        </group>
      )}
      {!building.has_solar && <mesh position={[w * 0.25, h + roofHeight + 0.35, -d * 0.18]} castShadow><boxGeometry args={[1.15, 0.7, 0.8]} /><meshStandardMaterial color="#75858A" roughness={0.65} metalness={0.35} /></mesh>}
      {(hovered || isSelected) && <Html position={[0, h + 1.45, 0]} center distanceFactor={18}><div className="pointer-events-none whitespace-nowrap rounded-md border border-white/10 bg-charcoal-900/90 px-2.5 py-1 text-xs text-white shadow-lg backdrop-blur-sm">{building.name}</div></Html>}
    </group>
  );
}

function CampusGround({ buildings }: { buildings: Building[] }) {
  const trees = useMemo(() => [[-31, 0, -22], [-29, 0, -4], [-30, 0, 23], [-8, 0, 25], [9, 0, 27], [29, 0, 23], [31, 0, -18], [8, 0, -22]] as [number, number, number][], []);
  const lamps = useMemo(() => [[-14, 0, 1], [12, 0, 1], [-28, 0, 6], [28, 0, 6], [-7, 0, -23], [8, 0, -23]] as [number, number, number][], []);
  return <>
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.01, 0]}><planeGeometry args={[140, 140]} /><meshStandardMaterial color="#13241D" roughness={0.95} /></mesh>
    <mesh position={[0, 0.015, 0]} receiveShadow><boxGeometry args={[7, 0.04, 70]} /><meshStandardMaterial color="#263B3B" roughness={0.9} /></mesh>
    <mesh position={[0, 0.02, 0]} receiveShadow><boxGeometry args={[70, 0.04, 7]} /><meshStandardMaterial color="#263B3B" roughness={0.9} /></mesh>
    <mesh position={[0, 0.03, -1]} receiveShadow><boxGeometry args={[70, 0.05, 1.4]} /><meshStandardMaterial color="#789A8B" roughness={0.96} /></mesh>
    <mesh position={[0, 0.035, -1]}><boxGeometry args={[68, 0.02, 0.06]} /><meshStandardMaterial color="#D6D9B4" emissive="#A8BF8C" emissiveIntensity={0.12} /></mesh>
    {trees.map((position, index) => <Tree key={`tree-${index}`} position={position} scale={index % 3 === 0 ? 1.15 : 0.85} />)}
    {lamps.map((position, index) => <LampPost key={`lamp-${index}`} position={position} />)}
    <Html position={[0, 0.18, -1]} center distanceFactor={24}><div className="pointer-events-none rounded-full border border-emerald-200/20 bg-emerald-950/40 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-emerald-100/70">GreenGrid Main Campus</div></Html>
    {buildings.length > 0 && <mesh position={[0, -0.02, 0]} visible={false}><boxGeometry args={[1, 1, 1]} /></mesh>}
  </>;
}

function Student({ index, entering }: { index: number; entering: boolean }) {
  const student = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const cycle = (clock.getElapsedTime() * 0.12 + index * 0.06) % 1;
    const progress = entering ? cycle : 1 - cycle;
    const row = Math.floor(index / 6);
    const col = index % 6;
    const x = -6.2 + col * 2.1;
    const z = -28.7 + row * 0.55;
    if (student.current) { student.current.position.x = entering ? THREE.MathUtils.lerp(-13, x, Math.min(1, progress * 2)) : THREE.MathUtils.lerp(x, 13, Math.min(1, progress * 2)); student.current.position.z = z; student.current.position.y = 0.45 + Math.abs(Math.sin(clock.getElapsedTime() * 5 + index)) * 0.04; }
  });
  return <group ref={student} position={[-13, 0.45, -28.7]}><mesh castShadow><capsuleGeometry args={[0.18, 0.5, 4, 8]} /><meshStandardMaterial color={index % 3 === 0 ? "#F2B880" : index % 3 === 1 ? "#8DD6D0" : "#C8A7E8"} roughness={0.6} /></mesh><mesh position={[0, 0.5, 0]}><sphereGeometry args={[0.2, 10, 8]} /><meshStandardMaterial color="#EAC29A" /></mesh></group>;
}

function ClassroomAutomation({ demoRunning }: { demoRunning: boolean }) {
  const fanRefs = useRef<(THREE.Group | null)[]>([]);
  const [occupied, setOccupied] = useState(true);
  useFrame(({ clock }) => {
    const hour = (clock.getElapsedTime() / 12 + 9) % 24;
    const nextOccupied = demoRunning ? Math.floor(clock.getElapsedTime() / 3) % 2 === 0 : hour >= 8 && hour < 17;
    if (nextOccupied !== occupied) setOccupied(nextOccupied);
    fanRefs.current.forEach((fan) => { if (fan) fan.rotation.y += nextOccupied ? 0.16 : 0.018; });
  });
  return <group position={[0, 0, -28]}>
    <mesh position={[0, 2.4, 0]} castShadow><boxGeometry args={[17, 4.8, 6]} /><meshStandardMaterial color="#304A58" transparent opacity={0.42} roughness={0.62} /></mesh>
    <mesh position={[0, 1.2, -31.05]}><boxGeometry args={[2.2, 2.4, 0.12]} /><meshStandardMaterial color="#A8D9D2" transparent opacity={0.5} emissive="#4E8D87" emissiveIntensity={0.25} /></mesh>
    <mesh position={[0, 0.12, -31.15]}><boxGeometry args={[3.2, 0.12, 0.55]} /><meshStandardMaterial color="#D6D9B4" roughness={0.8} /></mesh>
    {Array.from({ length: 12 }, (_, index) => <Student key={index} index={index} entering={occupied} />)}
    {[[-5, 0], [0, 0], [5, 0]].map(([x, z], index) => <group key={index} position={[x, 4.95, z]} ref={(node) => { if (node) fanRefs.current[index] = node; }}>
      <mesh><cylinderGeometry args={[0.18, 0.18, 0.1, 16]} /><meshStandardMaterial color="#C8D8D2" metalness={0.7} /></mesh>
      {[0, 1, 2, 3].map((blade) => <mesh key={blade} position={[Math.sin(blade * Math.PI / 2) * 0.7, 0, Math.cos(blade * Math.PI / 2) * 0.7]} rotation={[0, blade * Math.PI / 2, 0]}><boxGeometry args={[0.12, 0.04, 1.2]} /><meshStandardMaterial color="#87BDB0" /></mesh>)}
    </group>)}
    {[[-5, 3.2], [0, 3.2], [5, 3.2]].map(([x, z], index) => <mesh key={`light-${index}`} position={[x, 4.7, z]}><boxGeometry args={[2.4, 0.08, 0.25]} /><meshStandardMaterial color={occupied ? "#D5F5D8" : "#263B3B"} emissive={occupied ? "#8CF5B6" : "#000000"} emissiveIntensity={occupied ? 1.5 : 0} /></mesh>)}
    <Html position={[0, 6.2, 0]} center distanceFactor={18}><div className="pointer-events-none rounded-lg border border-white/10 bg-charcoal-900/90 px-2.5 py-1 text-[10px] text-white">Classroom automation · {occupied ? "128 students · lights + fans ON" : "empty · lights + fans OFF"}</div></Html>
  </group>;
}

function WindTurbine({ position }: { position: [number, number, number] }) {
  const blades = useRef<THREE.Group>(null);
  useFrame(() => { if (blades.current) blades.current.rotation.z += 0.045; });
  return <group position={position}>
    <mesh position={[0, 4, 0]} castShadow><cylinderGeometry args={[0.18, 0.35, 8, 12]} /><meshStandardMaterial color="#B6C8C3" metalness={0.7} roughness={0.28} /></mesh>
    <group ref={blades} position={[0, 7.4, 0]}>
      <mesh><sphereGeometry args={[0.35, 12, 12]} /><meshStandardMaterial color="#E4F1E7" emissive="#88E5B1" emissiveIntensity={0.5} /></mesh>
      {[0, 1, 2].map((blade) => <mesh key={blade} position={[0, Math.cos(blade * Math.PI * 2 / 3) * 1.8, Math.sin(blade * Math.PI * 2 / 3) * 1.8]} rotation={[blade * Math.PI * 2 / 3, 0, 0]}><boxGeometry args={[0.18, 3.2, 0.08]} /><meshStandardMaterial color="#D5E8E1" metalness={0.4} /></mesh>)}
    </group>
    <Html position={[0, 9.2, 0]} center distanceFactor={20}><div className="pointer-events-none text-[10px] text-emerald-100">WIND · 18 kW</div></Html>
  </group>;
}

function SolarSun() {
  const sun = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => { if (sun.current) { const pulse = 1 + Math.sin(clock.getElapsedTime() * 1.5) * 0.06; sun.current.scale.setScalar(pulse); } });
  return <group position={[31, 30, -27]}>
    <mesh ref={sun}><sphereGeometry args={[3, 24, 24]} /><meshStandardMaterial color="#FFE7A3" emissive="#FFB74D" emissiveIntensity={1.8} /></mesh>
    <pointLight color="#FFD08A" intensity={2.4} distance={80} />
    <Html position={[0, 4, 0]} center distanceFactor={24}><div className="pointer-events-none text-[10px] text-amber-100">SUNLIGHT · 42 kW peak</div></Html>
  </group>;
}

function AnimatedVehicle({ index, ev }: { index: number; ev: boolean }) {
  const vehicle = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = (clock.getElapsedTime() * 0.035 + index * 0.18) % 1;
    const phase = t * 4;
    let x = 0; let z = 0; let rotation = 0;
    if (phase < 1) { x = -31 + phase * 62; z = -3; rotation = 0; }
    else if (phase < 2) { x = 31; z = -3 + (phase - 1) * 32; rotation = Math.PI / 2; }
    else if (phase < 3) { x = 31 - (phase - 2) * 62; z = 29; rotation = Math.PI; }
    else { x = -31; z = 29 - (phase - 3) * 32; rotation = -Math.PI / 2; }
    if (vehicle.current) { vehicle.current.position.set(x, 0.55, z); vehicle.current.rotation.y = rotation; }
  });
  return <group ref={vehicle}>
    <mesh castShadow><boxGeometry args={[2.2, 0.55, 1.15]} /><meshStandardMaterial color={ev ? "#27C7B5" : "#D8775B"} metalness={0.45} roughness={0.35} emissive={ev ? "#0A6E68" : "#000000"} emissiveIntensity={ev ? 0.5 : 0} /></mesh>
    <mesh position={[0.15, 0.42, 0]}><boxGeometry args={[0.9, 0.35, 0.92]} /><meshStandardMaterial color="#20353B" roughness={0.18} metalness={0.5} /></mesh>
    {[-0.72, 0.72].map((x) => <mesh key={x} position={[x, -0.32, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.2, 0.2, 0.15, 12]} /><meshStandardMaterial color="#111827" /></mesh>)}
  </group>;
}

function CampusMobility() {
  return <group><AnimatedVehicle index={0} ev /><AnimatedVehicle index={1} ev /><AnimatedVehicle index={2} ev={false} /><AnimatedVehicle index={3} ev={false} /><AnimatedVehicle index={4} ev={false} /><Html position={[0, 0.4, 31]} center distanceFactor={20}><div className="pointer-events-none rounded-lg border border-white/10 bg-charcoal-900/90 px-2.5 py-1 text-[10px] text-white">Mobility camera · 2 EV · 3 combustion · live CO₂ estimate</div></Html></group>;
}

function BiogasPlant() {
  const bubbles = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (bubbles.current) bubbles.current.position.y = Math.sin(clock.getElapsedTime() * 2) * 0.14; });
  return <group position={[31, 0, 17]}>
    <mesh position={[0, 1.4, 0]} castShadow><cylinderGeometry args={[3.2, 3.2, 2.8, 24]} /><meshStandardMaterial color="#665342" roughness={0.82} /></mesh>
    <mesh position={[0, 3.1, 0]} castShadow><sphereGeometry args={[3.15, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#A77B42" roughness={0.42} metalness={0.22} /></mesh>
    <group ref={bubbles} position={[0, 3.8, 0]}>{[[-0.7, 0, 0.2], [0.4, 0, -0.4], [1, 0, 0.4]].map(([x, y, z], index) => <mesh key={index} position={[x, y, z]}><sphereGeometry args={[0.16, 10, 10]} /><meshStandardMaterial color="#BFEAD0" emissive="#60D394" emissiveIntensity={0.7} /></mesh>)}</group>
    <Html position={[0, 6, 0]} center distanceFactor={20}><div className="pointer-events-none rounded-lg border border-white/10 bg-charcoal-900/90 px-2.5 py-1 text-[10px] text-white">HOSTEL BIOGAS · 84 kg food waste → 35 kWh/day</div></Html>
  </group>;
}

function CampusSystems({ demoRunning }: { demoRunning: boolean }) {
  return <><ClassroomAutomation demoRunning={demoRunning} /><WindTurbine position={[34, 0, -10]} /><WindTurbine position={[34, 0, -1]} /><SolarSun /><CampusMobility /><BiogasPlant /></>;
}

function CameraRig({ target }: { target: [number, number, number] | null }) {
  const { camera } = useThree();
  const desired = useRef(new THREE.Vector3(0, 24, 38));
  const focus = useRef(new THREE.Vector3(0, 0, 0));
  useFrame(() => {
    if (target) { desired.current.set(target[0] + 10, target[1] + 8, target[2] + 11); focus.current.lerp(new THREE.Vector3(...target), 0.08); }
    else { desired.current.set(0, 24, 38); focus.current.lerp(new THREE.Vector3(0, 0, 0), 0.08); }
    if (target) { camera.position.lerp(desired.current, 0.055); camera.lookAt(focus.current); }
  });
  return null;
}

export default function CampusScene({ buildings, selectedId, onSelect, demoRunning = false, demoFocus = null }: { buildings: Building[]; selectedId: string | null; onSelect: (b: Building) => void; demoRunning?: boolean; demoFocus?: [number, number, number] | null }) {
  const selected = useMemo(() => buildings.find((b) => b.id === selectedId) ?? null, [buildings, selectedId]);
  const target: [number, number, number] | null = selected ? [selected.position[0], selected.footprint[1] / 2, selected.position[2]] : demoFocus;
  return <Canvas shadows camera={{ position: [0, 24, 38], fov: 42 }} dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: "high-performance" }}>
    <color attach="background" args={["#0B1210"]} /><fog attach="fog" args={["#0B1210", 44, 112]} />
    <ambientLight intensity={0.48} /><hemisphereLight args={["#9ED7D0", "#10231B", 0.7]} />
    <directionalLight position={[25, 32, 12]} intensity={1.7} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-far={120} shadow-camera-left={-55} shadow-camera-right={55} shadow-camera-top={55} shadow-camera-bottom={-55} />
    <CampusGround buildings={buildings} />
    <CampusSystems demoRunning={demoRunning} />
    <gridHelper args={[140, 28, "#1C3328", "#152821"]} />
    {buildings.map((b) => <BuildingMesh key={b.id} building={b} isSelected={b.id === selectedId} onSelect={onSelect} />)}
    <ContactShadows position={[0, 0, 0]} opacity={0.42} scale={110} blur={2.5} far={34} />
    <CameraRig target={target} /><OrbitControls enablePan enableRotate minPolarAngle={0.12} maxPolarAngle={Math.PI - 0.12} minDistance={5} maxDistance={120} makeDefault />
  </Canvas>;
}
