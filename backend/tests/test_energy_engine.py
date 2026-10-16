import pytest

from app.models.schemas import DeviceLoad, EnergyCalculationRequest
from app.services.energy_engine import calculate_energy_savings, device_energy_kwh


def test_device_energy_kwh_basic():
    assert device_energy_kwh(100, 10) == pytest.approx(1.0)
    assert device_energy_kwh(1500, 2) == pytest.approx(3.0)


def test_single_device_hand_calculated():
    # baseline = 100W * 10h / 1000 = 1.0 kWh ; optimized = 100W * 4h / 1000 = 0.4 kWh
    # gross = 0.6 ; net = 0.6 - 0.5 overhead = 0.1 ; percent = 0.1 / 1.0 * 100 = 10%
    request = EnergyCalculationRequest(
        devices=[DeviceLoad(device_id="fan-1", power_watts=100, baseline_hours=10, optimized_hours=4)],
        controller_overhead_kwh=0.5,
        tariff_per_kwh=8.0,
        emissions_factor_kg_per_kwh=0.82,
    )
    result = calculate_energy_savings(request)
    assert result.baseline_energy_kwh == pytest.approx(1.0)
    assert result.optimized_energy_kwh == pytest.approx(0.4)
    assert result.gross_savings_kwh == pytest.approx(0.6)
    assert result.net_savings_kwh == pytest.approx(0.1)
    assert result.savings_percent == pytest.approx(10.0)
    assert result.estimated_cost_avoided == pytest.approx(0.8)
    assert result.estimated_emissions_avoided_kg == pytest.approx(0.082, rel=1e-3)


def test_multi_device_sum_no_double_counting():
    request = EnergyCalculationRequest(
        devices=[
            DeviceLoad(device_id="light-1", power_watts=40, baseline_hours=12, optimized_hours=6),
            DeviceLoad(device_id="fan-1", power_watts=75, baseline_hours=12, optimized_hours=8),
        ],
        controller_overhead_kwh=0.0,
        tariff_per_kwh=0.0,
    )
    result = calculate_energy_savings(request)
    expected_baseline = (40 * 12 + 75 * 12) / 1000
    expected_optimized = (40 * 6 + 75 * 8) / 1000
    assert result.baseline_energy_kwh == pytest.approx(expected_baseline)
    assert result.optimized_energy_kwh == pytest.approx(expected_optimized)
    assert result.net_savings_kwh == pytest.approx(expected_baseline - expected_optimized)


def test_zero_baseline_handled_safely():
    request = EnergyCalculationRequest(
        devices=[DeviceLoad(device_id="d1", power_watts=100, baseline_hours=0, optimized_hours=0)],
        controller_overhead_kwh=0.2,
    )
    result = calculate_energy_savings(request)
    assert result.baseline_energy_kwh == 0
    assert result.savings_percent is None
    assert result.net_savings_kwh == pytest.approx(-0.2)
    assert any("zero" in a.lower() for a in result.assumptions)


def test_negative_savings_preserved_not_clamped():
    # Optimized usage (6h) exceeds baseline usage (2h): net savings must stay negative.
    request = EnergyCalculationRequest(
        devices=[DeviceLoad(device_id="d1", power_watts=200, baseline_hours=2, optimized_hours=6)],
        controller_overhead_kwh=0.0,
        tariff_per_kwh=10.0,
    )
    result = calculate_energy_savings(request)
    assert result.net_savings_kwh < 0
    assert result.savings_percent < 0
    assert result.estimated_cost_avoided < 0
    assert any("negative" in a.lower() for a in result.assumptions)


def test_controller_overhead_can_erase_gross_savings():
    request = EnergyCalculationRequest(
        devices=[DeviceLoad(device_id="d1", power_watts=50, baseline_hours=5, optimized_hours=4)],
        controller_overhead_kwh=1.0,  # larger than the 0.05 kWh gross saving
    )
    result = calculate_energy_savings(request)
    assert result.gross_savings_kwh == pytest.approx(0.05)
    assert result.net_savings_kwh == pytest.approx(-0.95)


def test_assumptions_are_always_visible():
    request = EnergyCalculationRequest(
        devices=[DeviceLoad(device_id="d1", power_watts=10, baseline_hours=1, optimized_hours=1)]
    )
    result = calculate_energy_savings(request)
    assert len(result.assumptions) >= 2
