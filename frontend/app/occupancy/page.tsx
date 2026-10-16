"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Image from "next/image";
import {
  analyzeVideo,
  detectImage,
  evaluateOccupancyEnergy,
  fetchVideoJob,
  fetchVisionStatus,
  type ImageDetectionResponse,
  type OccupancyEnergyEvaluationResponse,
  type VideoJobResponse,
  type VideoAnalysisResult,
  type VisionStatusResponse,
} from "@/lib/vision";

const DEFAULT_ROOM_ID = "classroom-101";
const DEFAULT_ROOM_NAME = "Classroom 101";
const DEFAULT_BUILDING_ID = "bldg-academic-a";

export default function OccupancyPage() {
  const [mode, setMode] = useState<"image" | "video">("image");
  const [file, setFile] = useState<File | null>(null);
  const [roomId, setRoomId] = useState(DEFAULT_ROOM_ID);
  const [roomName, setRoomName] = useState(DEFAULT_ROOM_NAME);
  const [buildingId, setBuildingId] = useState(DEFAULT_BUILDING_ID);
  const [capacity, setCapacity] = useState("40");
  const [visionStatus, setVisionStatus] = useState<VisionStatusResponse | null>(null);
  const [imageResult, setImageResult] = useState<ImageDetectionResponse | null>(null);
  const [job, setJob] = useState<VideoJobResponse | null>(null);
  const [energyResult, setEnergyResult] = useState<OccupancyEnergyEvaluationResponse | null>(null);
  const [powerWatts, setPowerWatts] = useState("100");
  const [baselineHours, setBaselineHours] = useState("10");
  const [optimizedHours, setOptimizedHours] = useState("4");
  const [tariffPerKwh, setTariffPerKwh] = useState("8");
  const [energyBusy, setEnergyBusy] = useState(false);
  const [energyError, setEnergyError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchVisionStatus().then((value) => { if (active) setVisionStatus(value); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") return;
    const timer = window.setTimeout(async () => {
      try {
        setJob(await fetchVideoJob(job.job_id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not retrieve video job status.");
      }
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [job]);

  const videoResult = job?.result ?? null;
  const displayed = imageResult ?? videoResult;
  const people = imageResult?.detected_people ?? videoResult?.current_occupancy ?? null;
  const percentage = imageResult?.occupancy_percentage ?? videoResult?.occupancy_percentage ?? null;
  const preview = imageResult?.annotated_image_data_url ?? videoResult?.annotated_preview_data_url ?? null;
  const detectionStatus = imageResult?.occupancy_status ?? videoResult?.occupancy_status ?? null;
  const recommendation = imageResult?.recommendation ?? videoResult?.recommendation ?? null;
  const canEvaluateEnergy = videoResult?.occupancy_status === "EMPTY_CONFIRMED";
  const fileAccept = useMemo(() => mode === "image" ? ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" : ".mp4,.mov,.avi,.mkv,.webm,video/*", [mode]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) { setError("Choose an image or prerecorded video first."); return; }
    setBusy(true);
    setError(null);
    setEnergyError(null);
    setImageResult(null);
    setEnergyResult(null);
    setJob(null);
    const details = { roomId, roomName, buildingId: buildingId || undefined, capacity: capacity ? Number(capacity) : undefined };
    try {
      if (mode === "image") setImageResult(await detectImage(file, details));
      else setJob(await analyzeVideo(file, details));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis could not be started.");
    } finally {
      setBusy(false);
    }
  }

  async function submitEnergyEstimate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!videoResult || !canEvaluateEnergy) return;
    setEnergyBusy(true);
    setEnergyError(null);
    setEnergyResult(null);
    try {
      setEnergyResult(await evaluateOccupancyEnergy({
        roomId: videoResult.room_id,
        powerWatts: Number(powerWatts),
        baselineHours: Number(baselineHours),
        optimizedHours: Number(optimizedHours),
        tariffPerKwh: Number(tariffPerKwh),
      }));
    } catch (e) {
      setEnergyError(e instanceof Error ? e.message : "The hypothetical energy calculation failed.");
    } finally {
      setEnergyBusy(false);
    }
  }

  const processing = busy || job?.status === "queued" || job?.status === "processing";
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Computer vision · occupancy</p>
          <h1 className="mt-2 font-display text-3xl text-white">Classroom occupancy monitor</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-400">Upload a still image for a one-frame count or a prerecorded clip for sampled YOLO26n detection and ByteTrack associations. No camera or face recognition is used.</p>
        </div>
        <div className={`rounded-lg border px-3 py-2 text-xs ${visionStatus?.available ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-amber-300/30 bg-amber-300/10 text-amber-100"}`}>
          {visionStatus?.available ? "Vision service ready" : visionStatus ? "Model setup required" : "Checking vision service…"}
        </div>
      </div>

      {visionStatus && !visionStatus.available && <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100"><strong>Setup note:</strong> {visionStatus.detail} The rest of GreenGrid remains usable without the model.</div>}
      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)]">
        <section className="rounded-2xl border border-white/10 bg-charcoal-900 p-5">
          <div className="mb-5 flex rounded-xl border border-white/5 bg-charcoal-950 p-1">
            <button type="button" onClick={() => { setMode("image"); setFile(null); setError(null); setJob(null); setImageResult(null); setEnergyResult(null); setEnergyError(null); }} className={`flex-1 rounded-lg px-3 py-2 text-sm ${mode === "image" ? "bg-emerald-300 font-semibold text-emerald-950" : "text-ink-400 hover:text-white"}`}>Image</button>
            <button type="button" onClick={() => { setMode("video"); setFile(null); setError(null); setJob(null); setImageResult(null); setEnergyResult(null); setEnergyError(null); }} className={`flex-1 rounded-lg px-3 py-2 text-sm ${mode === "video" ? "bg-emerald-300 font-semibold text-emerald-950" : "text-ink-400 hover:text-white"}`}>Prerecorded video</button>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm text-ink-300">Upload {mode === "image" ? "an image" : "a video"}
              <input key={mode} type="file" accept={fileAccept} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-lg border border-white/10 bg-charcoal-950 p-3 text-sm text-ink-300 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:text-white" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-ink-400">Room ID<input value={roomId} onChange={(e) => setRoomId(e.target.value)} maxLength={80} required className="mt-1 w-full rounded-lg border border-white/10 bg-charcoal-950 px-3 py-2.5 text-sm text-white" /></label>
              <label className="text-xs text-ink-400">Room name<input value={roomName} onChange={(e) => setRoomName(e.target.value)} maxLength={80} required className="mt-1 w-full rounded-lg border border-white/10 bg-charcoal-950 px-3 py-2.5 text-sm text-white" /></label>
              <label className="text-xs text-ink-400">Building ID (optional)<input value={buildingId} onChange={(e) => setBuildingId(e.target.value)} maxLength={80} className="mt-1 w-full rounded-lg border border-white/10 bg-charcoal-950 px-3 py-2.5 text-sm text-white" /></label>
              <label className="text-xs text-ink-400">Room capacity (optional)<input type="number" min="1" max="5000" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-charcoal-950 px-3 py-2.5 text-sm text-white" /></label>
            </div>
            {file && <p className="truncate text-xs text-ink-500">Selected: {file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB</p>}
            {error && <p role="alert" className="rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
            {job?.status === "failed" && <p role="alert" className="rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{job.detail}</p>}
            <button disabled={processing || !file} className="w-full rounded-lg bg-emerald-300 px-4 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50">{processing ? (mode === "video" ? "Processing video…" : "Analyzing image…") : "Run occupancy analysis"}</button>
            {mode === "video" && <p className="text-xs leading-5 text-ink-500">Video work is queued and processed in the background. Default limit: 50 MB / 120 seconds, sampled every 5 frames.</p>}
          </form>
        </section>

        <section className="rounded-2xl border border-white/10 bg-charcoal-900 p-5">
          <div className="flex items-center justify-between"><h2 className="font-display text-lg text-white">Analysis result</h2>{processing && <span className="text-xs text-amber-200">{job?.status === "queued" ? "Queued" : "Processing"}</span>}</div>
          {processing && <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-1/3 animate-pulse rounded-full bg-emerald-300" /></div>}
          {!displayed && !processing && <div className="mt-5 flex min-h-64 items-center justify-center rounded-xl border border-dashed border-white/10 bg-charcoal-950 px-5 text-center text-sm text-ink-500">Upload a file to see the annotated preview, occupancy count, and confidence details.</div>}
          {displayed && <>
            {preview && <Image unoptimized src={preview} width={1200} height={720} alt="Annotated preview with detected people and temporary tracking boxes" className="mt-4 max-h-[420px] w-full rounded-xl border border-white/10 bg-charcoal-950 object-contain" />}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Metric label="Current occupancy" value={people === null ? "—" : String(people)} />
              <Metric label="Room capacity" value={displayed.capacity == null ? "Not set" : String(displayed.capacity)} />
              <Metric label="Capacity used" value={percentage == null ? "—" : `${percentage.toFixed(1)}%`} />
              {videoResult && <Metric label="Peak in clip" value={String(videoResult.peak_occupancy)} />}
              {videoResult && <Metric label="Frames sampled" value={String(videoResult.frames_processed)} />}
              {videoResult && <Metric label="Track IDs observed" value={String(videoResult.tracked_ids_seen)} />}
            </div>
            <div className="mt-4 rounded-xl border border-white/5 bg-charcoal-950 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs uppercase tracking-wide text-ink-500">Occupancy decision</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${detectionStatus === "OCCUPIED" ? "bg-emerald-300/10 text-emerald-200" : detectionStatus === "EMPTY_CONFIRMED" ? "bg-amber-300/10 text-amber-100" : "bg-sky-300/10 text-sky-100"}`}>{detectionStatus?.replaceAll("_", " ")}</span></div>
              <p className="mt-3 text-sm leading-6 text-ink-200">{recommendation}</p>
              <p className="mt-2 text-xs text-ink-500">Detection quality: {(displayed.detection_quality * 100).toFixed(0)}% · Updated {new Date(displayed.last_updated).toLocaleString()}</p>
              {videoResult && <p className="mt-2 text-xs leading-5 text-ink-500">{videoResult.note}</p>}
            </div>
          </>}
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-white/10 bg-charcoal-900 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="font-display text-lg text-white">Hypothetical energy optimization</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-ink-400">This calculator uses the confirmed-empty video result as a gate, then estimates savings from the device assumptions you enter. It is not measured energy data and does not control equipment.</p></div>
          <span className="rounded-full border border-amber-200/20 bg-amber-300/5 px-2.5 py-1 text-[10px] text-amber-100">Simulation only · no meter connected</span>
        </div>
        <form onSubmit={submitEnergyEstimate} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs text-ink-400">Load power (W)<input type="number" min="0.01" step="any" required value={powerWatts} onChange={(e) => setPowerWatts(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-charcoal-950 px-3 py-2.5 text-sm text-white" /></label>
          <label className="text-xs text-ink-400">Baseline hours<input type="number" min="0" step="any" required value={baselineHours} onChange={(e) => setBaselineHours(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-charcoal-950 px-3 py-2.5 text-sm text-white" /></label>
          <label className="text-xs text-ink-400">Optimized hours<input type="number" min="0" step="any" required value={optimizedHours} onChange={(e) => setOptimizedHours(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-charcoal-950 px-3 py-2.5 text-sm text-white" /></label>
          <label className="text-xs text-ink-400">Tariff (₹/kWh)<input type="number" min="0" step="any" required value={tariffPerKwh} onChange={(e) => setTariffPerKwh(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-charcoal-950 px-3 py-2.5 text-sm text-white" /></label>
          <button disabled={!canEvaluateEnergy || energyBusy} className="self-end rounded-lg bg-cyan-200 px-4 py-3 text-sm font-semibold text-cyan-950 disabled:cursor-not-allowed disabled:opacity-40">{energyBusy ? "Calculating…" : "Estimate savings"}</button>
        </form>
        {!canEvaluateEnergy && <p className="mt-3 text-xs text-ink-500">Available only after a video analysis reports sufficiently reliable, sustained empty-room evidence (EMPTY_CONFIRMED). A single image or an occupied/uncertain sample cannot pass this gate.</p>}
        {energyError && <p role="alert" className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{energyError}</p>}
        {energyResult && <div className="mt-4 rounded-xl border border-cyan-200/15 bg-cyan-300/[0.05] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-100">Illustrative calculation · {energyResult.room_id}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Baseline" value={`${energyResult.calculation.baseline_energy_kwh.toFixed(3)} kWh`} />
            <Metric label="Optimized" value={`${energyResult.calculation.optimized_energy_kwh.toFixed(3)} kWh`} />
            <Metric label="Net energy saved" value={`${energyResult.calculation.net_savings_kwh.toFixed(3)} kWh`} />
            <Metric label="Estimated cost avoided" value={`₹${energyResult.calculation.estimated_cost_avoided.toFixed(2)}`} />
          </div>
          <p className="mt-3 text-xs leading-5 text-ink-400">{energyResult.note}</p>
        </div>}
      </section>

      <div className="mt-6 rounded-xl border border-white/5 bg-charcoal-900/60 p-4 text-xs leading-5 text-ink-500"><strong className="text-ink-300">Energy safety:</strong> no room power meter, timetable, or equipment controls are connected. Uploaded-video counts are actual model outputs; campus energy displays elsewhere remain simulated demo data. This page does not switch anything off. Face recognition and identity storage are not implemented.</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/5 bg-charcoal-950 p-3"><p className="text-[11px] text-ink-500">{label}</p><p className="mt-1 font-display text-xl text-white">{value}</p></div>;
}
