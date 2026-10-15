import type { DataMode } from "@/lib/types";

const COPY: Record<DataMode, string> = {
  demo: "DEMO DATA — simulated",
  live: "LIVE DATA",
  replay: "REPLAY MODE",
};

const STYLE: Record<DataMode, string> = {
  demo: "border-amber-500/30 bg-amber-500/15 text-amber-300",
  live: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  replay: "border-sky-500/30 bg-sky-500/15 text-sky-300",
};

export default function DataModeBadge({ mode = "demo" }: { mode?: DataMode }) {
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${STYLE[mode]}`}>
      {COPY[mode]}
    </span>
  );
}
