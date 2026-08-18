# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Product decisions

- The prototype must visibly operate as a real-time command center, with a reconnecting live-data status and continuously updating simulated telemetry.
- Future drone, unmanned-vessel, wheeled-robot, and quadruped-robot integration must enter through a normalized gateway contract; the browser never directly sends low-level vehicle controls.
- Any command path remains simulation-only unless an authenticated edge gateway, safety checks, electronic-fence constraints, and an explicit human approval step are available.
- The operational map is a release-facing WebGL engineering scene: retain left-drag panning, right-drag rotation, wheel/button zoom, orthographic/oblique/dam-detail views, device-to-world-coordinate overlays, and a stable WGS-84 HUD when replacing the demo terrain with GIS/DEM/3D-Tiles data.
- Electronic fences are drawn as custom 3D terrain polygons (at least three points) with create, undo, save, and delete paths; real commands still require the approved fence version to be synchronized and checked by the edge safety controller. Sensor monitoring reads normalized per-device `sensors` telemetry and must stay tied to the gateway update stream.
- The user requires a formal operator workflow rather than a demo fallback. `启动正式系统.cmd` must open the local operator console on port 8080 in `integration` mode with no fabricated fleet, alert, video, or task data. Browser-originated actions can only create auditable pending-approval requests; a stock build must reject `live` device commands until a certified edge execution adapter is separately installed and authorized.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
