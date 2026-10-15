from __future__ import annotations

from app.models.schemas import EnergyCalculationRequest, EnergyCalculationResult


def device_energy_kwh(power_watts: float, hours: float) -> float:
    """Energy (kWh) = Power (W) x Operating time (hours) / 1000."""
    return (power_watts * hours) / 1000.0


def calculate_energy_savings(request: EnergyCalculationRequest) -> EnergyCalculationResult:
    """Deterministic, side-effect-free energy savings calculation.

    E_baseline   = sum(P_i * t_i_baseline / 1000)
    E_optimized  = sum(P_i * t_i_optimized / 1000)
    E_net_saved  = E_baseline - E_optimized - E_controller_overhead
    savings %    = E_net_saved / E_baseline * 100   (only when E_baseline > 0)
    cost avoided = E_net_saved * tariff_per_kwh
    """
    assumptions: list[str] = [
        "Energy = Power (W) x Operating hours / 1000.",
        f"Controller overhead applied once per evaluation period: {request.controller_overhead_kwh} kWh.",
    ]

    baseline = sum(device_energy_kwh(d.power_watts, d.baseline_hours) for d in request.devices)
    optimized = sum(device_energy_kwh(d.power_watts, d.optimized_hours) for d in request.devices)

    gross_savings = baseline - optimized
    net_savings = gross_savings - request.controller_overhead_kwh

    if baseline > 0:
        savings_percent: float | None = (net_savings / baseline) * 100.0
    else:
        savings_percent = None
        assumptions.append("Baseline energy was zero; savings percent is not defined.")

    estimated_cost_avoided = net_savings * request.tariff_per_kwh
    if request.tariff_per_kwh == 0:
        assumptions.append("No tariff configured; estimated cost avoided defaults to 0.")

    estimated_emissions_avoided_kg: float | None
    if request.emissions_factor_kg_per_kwh is not None:
        estimated_emissions_avoided_kg = net_savings * request.emissions_factor_kg_per_kwh
    else:
        estimated_emissions_avoided_kg = None
        assumptions.append("No emissions factor configured; emissions impact is not estimated.")

    if net_savings < 0:
        assumptions.append("Net savings are negative: optimized consumption plus overhead exceeded baseline.")

    return EnergyCalculationResult(
        baseline_energy_kwh=round(baseline, 4),
        optimized_energy_kwh=round(optimized, 4),
        gross_savings_kwh=round(gross_savings, 4),
        controller_overhead_kwh=round(request.controller_overhead_kwh, 4),
        net_savings_kwh=round(net_savings, 4),
        savings_percent=round(savings_percent, 2) if savings_percent is not None else None,
        estimated_cost_avoided=round(estimated_cost_avoided, 2),
        estimated_emissions_avoided_kg=(
            round(estimated_emissions_avoided_kg, 4) if estimated_emissions_avoided_kg is not None else None
        ),
        assumptions=assumptions,
    )
