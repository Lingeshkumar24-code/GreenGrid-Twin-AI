"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS: { label: string; href: string | null }[] = [
  { label: "Campus Overview", href: "/" },
  { label: "3D Digital Twin", href: "/twin" },
  { label: "Energy Monitoring", href: null },
  { label: "Classroom Occupancy", href: "/occupancy" },
  { label: "Building Sustainability", href: null },
  { label: "Renewable Energy", href: null },
  { label: "Water Monitoring", href: null },
  { label: "Traffic & Computer Vision", href: null },
  { label: "Forecasting", href: null },
  { label: "AI Agents", href: null },
  { label: "Green AI Assistant", href: null },
  { label: "Optimization Center", href: null },
  { label: "Financial Intelligence", href: null },
  { label: "Reports & Settings", href: null },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex h-full w-60 shrink-0 flex-col border-r border-white/5 bg-charcoal-950 px-3 py-5">
      <div className="mb-6 px-2">
        <p className="font-display text-base text-white">GreenGrid Twin AI</p>
        <p className="text-xs text-ink-500">Smart campus digital twin</p>
      </div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto">
        {SECTIONS.map((s) => {
          const active = s.href !== null && pathname === s.href;
          if (s.href === null) {
            return (
              <li
                key={s.label}
                className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-ink-600"
              >
                <span>{s.label}</span>
                <span className="rounded border border-white/5 px-1.5 py-0.5 text-[10px] tracking-wide text-ink-600">
                  Planned
                </span>
              </li>
            );
          }
          return (
            <li key={s.label}>
              <Link
                href={s.href}
                className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "text-ink-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                {s.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
