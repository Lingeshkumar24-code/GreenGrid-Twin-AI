# GreenGrid Classroom Interior

This focused source bundle contains **only the classroom interior**, its charts, and the classroom-specific movement, zone-control and energy logic. It does not include the campus scene, vehicle/video tools, backend, or the rest of the GreenGrid application.

## Contents

- `frontend/components/ClassroomInterior.tsx` — 3D classroom, stylized deterministic student simulation, camera/cutaway controls, schedules, per-zone lights/fans, energy controls and event log.
- `frontend/components/ClassroomAnalytics.tsx` — occupancy, energy and runtime charts derived from classroom state.
- `frontend/lib/classroom-engine.ts` — student routes, schedules, phases and zone occupancy.
- `frontend/lib/classroom-controls.ts` — occupancy confirmation, per-zone vacancy timers and manual overrides.
- `frontend/lib/classroom-energy.ts` — rated-power runtime, baseline/optimized energy and cost calculations.

## Use in the existing GreenGrid frontend

Preserve the folder paths when copying these files into the project. The interior is a client component and accepts:

```tsx
<ClassroomInterior
  onClose={() => setClassroomOpen(false)}
  tourFocus={null}
  onManualControl={() => stopTour()}
/>
```

`onClose` is required; `tourFocus` and `onManualControl` are optional. The imports assume the GreenGrid `@/components` and `@/lib` aliases. The host app should already have React/Next.js, Tailwind CSS with the GreenGrid theme tokens, Three.js `0.160.0`, React Three Fiber `8.15.19`, Drei `9.102.6` and Recharts `2.12.7` installed.

Occupancy, schedules, lighting/fans and energy are **simulated**. This bundle does not connect sensors or identify real people.
