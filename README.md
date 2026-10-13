# RoutePlanner

RoutePlanner is a modular real-map route plotting workspace built as the first slice of a future all-in-one fitness platform.
This was messing around with using google antigravity for coding.

## Run

```bash
npm run start
```

Then open `http://localhost:5173`.

## Checks

```bash
npm run check
```

## Current Capabilities

- Plot routes on OpenStreetMap tiles with Leaflet.
- Add, drag, undo, clear, and load demo route points.
- Optionally snap plotted routes through the public OSRM demo routing service, with an offline straight-line fallback.
- Load real terrain elevation from Open-Elevation for the chart, route metrics, and GPX export.
- Load route weather from the free Open-Meteo forecast API.
- Export the current route to GPX.
- Show distance, elevation gain, estimated time, weather summaries, route surface split, and elevation profile.

## Architecture

- `src/app`: application composition and state orchestration.
- `src/domain`: fitness and route domain models, metrics, weather, route storage.
- `src/maps`: Leaflet map adapter. This boundary keeps the rest of the app independent from the map provider.
- `src/services`: external-facing services such as GPX export and route snapping.
- `src/ui`: DOM rendering and canvas chart modules.
- `src/styles`: design tokens, layout, components, map, and chart styles.

The code favors small modules with explicit inputs and outputs so the route planner can grow into training, calendar, coaching, nutrition, gear, and analytics areas without turning the map screen into the platform core.
