import { ZONES, type ZoneId } from "./classroom-engine";

export type Override = "auto" | "on" | "off";
export type DeviceEvent = { id: number; time: string; zone: ZoneId; device: "LIGHTS" | "FAN"; state: "ON" | "OFF"; reason: string };
export type ZoneControl = {
  confirmed: boolean;
  confirmationSeconds: number;
  vacancySeconds: number;
  vacancyTimeout: number;
  lights: Override;
  fan: Override;
  lightOn: boolean;
  fanOn: boolean;
  lightHours: number;
  fanHours: number;
  fanWatts: number;
};
export type ZoneStates = Record<ZoneId, ZoneControl>;
let nextEventId = 1;

export function createZoneControl(): ZoneControl {
  return { confirmed: false, confirmationSeconds: 0, vacancySeconds: 0, vacancyTimeout: 30, lights: "auto", fan: "auto", lightOn: false, fanOn: false, lightHours: 0, fanHours: 0, fanWatts: 62 };
}

export function createZoneStates(): ZoneStates {
  return { A: createZoneControl(), B: createZoneControl(), C: createZoneControl(), D: createZoneControl() };
}

export function advanceZoneControls(
  previous: ZoneStates,
  occupancy: Record<ZoneId, number>,
  dtSeconds: number,
  simulationSpeed: number,
  simTime: string,
  lightWattsPerZone = 76,
): { zones: ZoneStates; events: DeviceEvent[] } {
  const zones = { ...previous };
  const events: DeviceEvent[] = [];
  for (const zone of ZONES) {
    const old = previous[zone];
    const count = occupancy[zone];
    const confirmationSeconds = count > 0 ? old.confirmationSeconds + dtSeconds : 0;
    const confirmed = count > 0 && confirmationSeconds >= 2;
    const vacancySeconds = count > 0 ? 0 : old.lights === "auto" && old.lightOn ? old.vacancySeconds + dtSeconds * simulationSpeed : 0;
    const lightOn = old.lights === "on" ? true : old.lights === "off" ? false : confirmed || (old.lightOn && vacancySeconds < old.vacancyTimeout * 60);
    const fanOn = old.fan === "on" ? true : old.fan === "off" ? false : confirmed;
    const noteTransition = (device: "LIGHTS" | "FAN", wasOn: boolean, isOn: boolean) => {
      if (wasOn === isOn) return;
      const override = old[device === "LIGHTS" ? "lights" : "fan"];
      const reason = override !== "auto" ? "Manual override" : confirmed ? "Confirmed occupancy" : `Vacant for ${Math.round(vacancySeconds / 60)} simulated min`;
      events.unshift({ id: nextEventId++, time: simTime, zone, device, state: isOn ? "ON" : "OFF", reason });
    };
    noteTransition("LIGHTS", old.lightOn, lightOn);
    noteTransition("FAN", old.fanOn, fanOn);
    zones[zone] = {
      ...old,
      confirmed,
      confirmationSeconds,
      vacancySeconds,
      lightOn,
      fanOn,
      lightHours: old.lightHours + (lightOn ? dtSeconds * simulationSpeed / 3600 : 0),
      fanHours: old.fanHours + (fanOn ? dtSeconds * simulationSpeed / 3600 : 0),
    };
  }
  return { zones, events };
}

export function setZoneOverride(zones: ZoneStates, zone: ZoneId, device: "lights" | "fan", override: Override): ZoneStates {
  return { ...zones, [zone]: { ...zones[zone], [device]: override } };
}

export function resetZoneEventIds(): void {
  nextEventId = 1;
}
