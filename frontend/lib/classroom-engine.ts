export const ZONES = ["A", "B", "C", "D"] as const;
export type ZoneId = (typeof ZONES)[number];
export type StudentPhase = "outside" | "entering" | "walking" | "sitting" | "standing" | "leaving";
export type StudentAgent = {
  id: number;
  phase: StudentPhase;
  zone: ZoneId;
  seat: number;
  position: [number, number, number];
  route: [number, number, number][];
  phaseSeconds: number;
  arrived: boolean;
};
export type ClassSchedule = {
  classSize: number;
  nowMinutes: number;
  startMinutes: number;
  endMinutes: number;
  breakStartMinutes: number;
  breakEndMinutes: number;
};
export const STUDENT_WALK_SPEED_MPS = 1.05;
const INITIAL_POSITION: [number, number, number] = [0, 0, 6.6];
const ENTRY_STAGGER_MINUTES = 2;
const EXIT_STAGGER_MINUTES = 1;

export function createStudentAgents(): StudentAgent[] {
  return Array.from({ length: 24 }, (_, id) => ({
    id,
    phase: "outside",
    zone: seatFor(id).zone,
    seat: id,
    position: [...INITIAL_POSITION],
    route: routeToSeat(id),
    phaseSeconds: 0,
    arrived: false,
  }));
}

export function seatFor(id: number) {
  const desk = Math.floor(id / 2);
  const zoneIndex = Math.floor(desk / 3);
  const row = desk % 3;
  const deskX = [-5.05, -3.0, 3.0, 5.05][zoneIndex];
  const side = id % 2;
  const z = [-2.2, -0.05, 2.1][row];
  return { zone: ZONES[zoneIndex], x: deskX + (side ? 0.43 : -0.43), z: z + 0.79, deskX, deskZ: z, seat: id };
}

export function routeToSeat(id: number): [number, number, number][] {
  const seat = seatFor(id);
  return [[0, 0, 6.6], [0, 0, 4.6], [0, 0, 3.25], [seat.x, 0, 3.25], [seat.x, 0, seat.z + 0.85], [seat.x, 0, seat.z]];
}

export function pathLength(path: [number, number, number][]): number {
  return path.slice(1).reduce((sum, point, index) => sum + Math.hypot(point[0] - path[index][0], point[2] - path[index][2]), 0);
}

export function positionOnPath(path: [number, number, number][], seconds: number): [number, number, number] {
  let remaining = Math.max(0, seconds) * STUDENT_WALK_SPEED_MPS;
  for (let i = 0; i < path.length - 1; i += 1) {
    const a = path[i], b = path[i + 1];
    const distance = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (remaining <= distance) {
      const t = distance > 0 ? remaining / distance : 1;
      return [a[0] + (b[0] - a[0]) * t, 0, a[2] + (b[2] - a[2]) * t];
    }
    remaining -= distance;
  }
  const last = path[path.length - 1];
  return [last[0], 0, last[2]];
}

export function pathSegmentAtTime(path: [number, number, number][], seconds: number): number {
  let remaining = Math.max(0, seconds) * STUDENT_WALK_SPEED_MPS;
  for (let i = 0; i < path.length - 1; i += 1) {
    const a = path[i], b = path[i + 1];
    const distance = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (remaining <= distance) return i;
    remaining -= distance;
  }
  return Math.max(0, path.length - 2);
}

export function isWithinMinuteWindow(now: number, start: number, end: number): boolean {
  const minute = ((now % 1440) + 1440) % 1440;
  if (start === end) return false;
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

export function minutesBetween(start: number, end: number): number {
  return ((end - start) % 1440 + 1440) % 1440;
}

export function advanceStudents(agents: StudentAgent[], schedule: ClassSchedule, dtSeconds: number): StudentAgent[] {
  const now = ((schedule.nowMinutes % 1440) + 1440) % 1440;
  const classDuration = minutesBetween(schedule.startMinutes, schedule.endMinutes);
  const fromStart = minutesBetween(schedule.startMinutes, now);
  const inClass = classDuration > 0 && fromStart < classDuration;
  const pastEnd = classDuration > 0 && !inClass && (
    schedule.startMinutes < schedule.endMinutes
      ? now >= schedule.endMinutes
      : now >= schedule.endMinutes && now < schedule.startMinutes
  );
  const minutesAfterEnd = minutesBetween(schedule.endMinutes, now);
  const inBreak = isWithinMinuteWindow(now, schedule.breakStartMinutes, schedule.breakEndMinutes);

  return agents.map((source) => {
    let agent: StudentAgent = { ...source, position: [...source.position] };
    const studentStagger = agent.id * ENTRY_STAGGER_MINUTES;
    if (agent.phase === "outside" && !agent.arrived && agent.id < schedule.classSize && inClass && fromStart >= studentStagger) {
      agent = { ...agent, phase: "entering", route: routeToSeat(agent.id), phaseSeconds: 0, arrived: true };
    }

    if ((agent.phase === "entering" || agent.phase === "walking") && agent.route.length > 1) {
      const age = agent.phaseSeconds + dtSeconds;
      const travelTime = pathLength(agent.route) / STUDENT_WALK_SPEED_MPS;
      if (age >= travelTime) {
        agent = { ...agent, phase: "sitting", position: agent.route[agent.route.length - 1], phaseSeconds: 0 };
      } else {
        agent = { ...agent, phase: age < 2 ? "entering" : "walking", position: positionOnPath(agent.route, age), phaseSeconds: age };
      }
    }

    if (agent.phase === "sitting" && inBreak) agent = { ...agent, phase: "standing" };
    if (agent.phase === "standing" && !inBreak) agent = { ...agent, phase: "sitting" };
    const departureDelay = Math.max(0, schedule.classSize - 1 - agent.id) * EXIT_STAGGER_MINUTES;
    const scheduleExit = pastEnd && agent.arrived && minutesAfterEnd >= departureDelay;
    if ((agent.phase === "sitting" || agent.phase === "standing") && (agent.id >= schedule.classSize || scheduleExit)) {
      agent = { ...agent, phase: "leaving", route: [...routeToSeat(agent.id)].reverse(), phaseSeconds: 0 };
    }
    if (agent.phase === "leaving") {
      const age = agent.phaseSeconds + dtSeconds;
      const travelTime = pathLength(agent.route) / STUDENT_WALK_SPEED_MPS;
      if (age >= travelTime) {
        agent = { ...agent, phase: "outside", position: [...INITIAL_POSITION], phaseSeconds: 0 };
      } else {
        agent = { ...agent, position: positionOnPath(agent.route, age), phaseSeconds: age };
      }
    }
    return agent;
  });
}

export function occupancyByZone(agents: StudentAgent[]): Record<ZoneId, number> {
  return ZONES.reduce((counts, zone) => {
    counts[zone] = agents.filter((agent) => agent.zone === zone && agent.phase !== "outside").length;
    return counts;
  }, { A: 0, B: 0, C: 0, D: 0 } as Record<ZoneId, number>);
}

export function totalOccupancy(agents: StudentAgent[]): number {
  return agents.filter((agent) => agent.phase !== "outside").length;
}

export function formatSimulationTime(minutes: number): string {
  const value = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
