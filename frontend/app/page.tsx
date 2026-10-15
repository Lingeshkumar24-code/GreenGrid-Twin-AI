"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchCampus } from "@/lib/api";
import type { Campus } from "@/lib/types";

const STATUS_DOT: Record<string, string> = {
  nominal: "bg-emerald-400",
  advisory: "bg-amber-400",
  critical: "bg-rose-400",
  renewable: "bg-sky-400",
};

export default function CampusOverviewPage() {
  const [campus, setCampus] = useState<Campus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCampus()
      .then(setCampus)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-display text-3xl text-white">Campus Overview</h1>
      <p className="mt-2 max-w-xl text-sm text-ink-400">
        Every number below comes from the deterministic demo data provider, clearly labeled as simulated
        until live sensors are connected.
      </p>

      {loading && <SkeletonStats />}

      {error && (
        <div className="mt-6 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          Could not reach the backend API: {error}. Start the FastAPI server and make sure
          NEXT_PUBLIC_API_BASE_URL points to it, then reload.
        </div>
      )}

      {campus && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Buildings" value={`${campus.building_count}`} />
            <StatCard label="Current power" value={`${campus.total_current_power_kw.toFixed(1)} kW`} />
            <StatCard label="Energy today" value={`${campus.total_daily_energy_kwh.toFixed(0)} kWh`} />
            <StatCard label="Water today" value={`${(campus.total_daily_water_liters / 1000).toFixed(1)} kL`} />
            <StatCard
              label="Avg sustainability score"
              value={`${campus.average_sustainability_score.toFixed(0)}/100`}
            />
          </div>

          <div className="mt-10 flex items-center justify-between">
            <h2 className="font-display text-xl text-white">Buildings</h2>
            <Link href="/twin" className="text-sm text-emerald-300 hover:text-emerald-200">
              Open 3D Digital Twin →
            </Link>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-white/5">
            <table className="w-full text-left text-sm">
              <thead className="bg-charcoal-900 text-ink-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Building</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Power</th>
                  <th className="px-4 py-3 font-medium">Occupancy</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {campus.buildings.map((b) => (
                  <tr key={b.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-white">{b.name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 text-ink-300">
                        <span className={`h-2 w-2 rounded-full ${STATUS_DOT[b.status]}`} />
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-300">{b.current_power_kw.toFixed(1)} kW</td>
                    <td className="px-4 py-3 text-ink-300">{b.occupancy_percent.toFixed(0)}%</td>
                    <td className="px-4 py-3 text-ink-300">{b.sustainability_score}/100</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-charcoal-900 p-4">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-1 font-display text-2xl text-white">{value}</p>
    </div>
  );
}

function SkeletonStats() {
  return (
    <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl border border-white/5 bg-charcoal-900" />
      ))}
    </div>
  );
}
