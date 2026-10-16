import { ZONES, type ZoneId } from "./classroom-engine";
import type { ZoneStates } from "./classroom-controls";

export const LIGHT_POWER_W_PER_ZONE = 2 * 38;
export const DEFAULT_CONTROLLER_W_PER_ZONE = 2;
export const DEFAULT_TARIFF_PER_KWH = 15;

export type ClassroomEnergy = {
  baselineEnergyKwh: number;
  optimizedEnergyKwh: number;
  controllerOverheadKwh: number;
  optimizedIncludingOverheadKwh: number;
  grossSavingsKwh: number;
  netSavingsKwh: number;
  savingsPercent: number | null;
  baselineCost: number;
  optimizedCost: number;
  grossCostSavings: number;
  netCostSavings: number;
  currentPowerW: number;
  periodHours: number;
  zones: { zone: ZoneId; baselineKwh: number; optimizedKwh: number; runtimeHours: number }[];
};

export function energyFromRuntime(
  zoneStates: ZoneStates,
  periodHours: number,
  controllerWattsPerZone: number,
  tariffPerKwh: number,
): ClassroomEnergy {
  const period = Math.max(0, Number.isFinite(periodHours) ? periodHours : 0);
  const controllerWatts = Math.max(0, Number.isFinite(controllerWattsPerZone) ? controllerWattsPerZone : 0);
  const tariff = Math.max(0, Number.isFinite(tariffPerKwh) ? tariffPerKwh : 0);
  const zones = ZONES.map((zone) => {
    const state = zoneStates[zone];
    const optimizedKwh = (LIGHT_POWER_W_PER_ZONE * state.lightHours + Math.max(0, state.fanWatts) * state.fanHours) / 1000;
    const baselineKwh = (LIGHT_POWER_W_PER_ZONE + Math.max(0, state.fanWatts)) * period / 1000;
    return { zone, baselineKwh, optimizedKwh, runtimeHours: state.lightHours + state.fanHours };
  });
  const baselineEnergyKwh = zones.reduce((sum, zone) => sum + zone.baselineKwh, 0);
  const optimizedEnergyKwh = zones.reduce((sum, zone) => sum + zone.optimizedKwh, 0);
  const controllerOverheadKwh = controllerWatts * ZONES.length * period / 1000;
  const optimizedIncludingOverheadKwh = optimizedEnergyKwh + controllerOverheadKwh;
  const grossSavingsKwh = baselineEnergyKwh - optimizedEnergyKwh;
  const netSavingsKwh = grossSavingsKwh - controllerOverheadKwh;
  const baselineCost = baselineEnergyKwh * tariff;
  const optimizedCost = optimizedIncludingOverheadKwh * tariff;
  return {
    baselineEnergyKwh,
    optimizedEnergyKwh,
    controllerOverheadKwh,
    optimizedIncludingOverheadKwh,
    grossSavingsKwh,
    netSavingsKwh,
    savingsPercent: baselineEnergyKwh > 0 ? netSavingsKwh / baselineEnergyKwh * 100 : null,
    baselineCost,
    optimizedCost,
    grossCostSavings: grossSavingsKwh * tariff,
    netCostSavings: netSavingsKwh * tariff,
    currentPowerW: ZONES.reduce((sum, zone) => sum + (zoneStates[zone].lightOn ? LIGHT_POWER_W_PER_ZONE : 0) + (zoneStates[zone].fanOn ? Math.max(0, zoneStates[zone].fanWatts) : 0), 0),
    periodHours: period,
    zones,
  };
}

export function simulatedElapsedHours(startedAt: number, now: number): number {
  return Math.max(0, (now - startedAt) / 60);
}
