---
name: sketchforge-pcb-mcp
description: Control any open local SketchForge PCB editor through its MCP server. Use when Codex needs to identify live PCB editor tabs; inspect or capture a centered image of a circuit; draw or replace a board outline/cutout; place, configure, move, rotate, mirror, hide, or remove supported components; choose component values, footprints, LED colours, or customizable connector gender/pin count; create deliberately organized multi-segment wire routes and junctions; build a complete PCB in one operation; or inspect electrical and board errors.
---

# SketchForge PCB MCP

Use the live editor as the source of truth. This skill is global: it targets any currently open SketchForge PCB project by its 5-digit editor number, not one hard-coded PCB file.

## Connect

The app must be running locally in development mode. Its editor tabs heartbeat to `/api/sketchforge-pcb-mcp`; the stdio MCP server forwards commands through that route.

1. Call `sketchforge_pcb_list_editors`. Duplicate tabs of the same project are consolidated into one healthy project connection.
2. Match the requested `projectName` or `projectId`. Prefer the stable `projectId` for subsequent calls; `editorNumber` remains available for one-off human-directed targeting.
3. If multiple distinct projects are open and the target is ambiguous, ask which project to use.
4. Pass `projectId` to every remaining call. If exactly one project is open, it may be omitted.

## Required Discovery

Before changing a design:

1. Call `sketchforge_pcb_read_scene` to inspect the current board, ids, absolute pin positions, existing routes, and grid.
2. Call `sketchforge_pcb_list_components` before placing parts. Treat its live catalog and exact pad coordinates as authoritative.
3. Read [components.md](references/components.md) for the complete supported component/footprint inventory and configurable fields.
4. Read [mcp-tools.md](references/mcp-tools.md) for tool schemas and complete-build examples.

## Build a Complete PCB

Prefer `sketchforge_pcb_build_design` when creating a complete design. It commits the board, configured components, wires, and junctions together and lets wires refer to component `key` aliases created in that same call.

1. Translate the request into electrical blocks: power, inputs/sensors, control/logic, outputs, protection, and connectors.
2. Choose real supported footprints and settings. Set every relevant `value`, `footprint`, `rotation`, and connector `gender`/`pinCount`; do not leave customizable choices implicit when the request determines them.
3. Define the board outline in millimeters. Leave practical edge clearance around components and routes. Use at most one closed inner `cutout`; it must remain strictly inside the outer contour.
4. Place components before routing. Keep related parts close, align repeated parts, point pins toward their destinations, and reserve clean routing channels. Components must not overlap one another, mounting holes, cutouts, or the board edge; move or rotate parts until every footprint has visible physical clearance.
5. Route every connection with deliberate `pointsMm` and organized routing lanes. Do not accept a direct endpoint-to-endpoint segment merely because it is electrically valid. Use the pin coordinates returned by the scene/catalog rather than guessing from component bodies.
6. Call `sketchforge_pcb_read_scene`, then `sketchforge_pcb_inspect_design`. Correct invalid wires, duplicate references, unintended open pins, missing board geometry, component overlaps, route/body intersections, or visually poor layout before finishing. A design is not complete merely because its endpoints are electrically connected.

Use `replaceExisting: true` only when the user asked for a fresh design or the open project is intentionally being replaced. Otherwise leave it false and add to the current scene.

## Wire-Layout Rules

- Wires must be well organized and look deliberate. A tangled fan-out, spiderweb, dense diagonal spray, or arbitrary criss-cross routing is a failed result and must be rerouted before finishing.
- Route from exact pins, never from the component body.
- Do not connect two components with one long, straight, point-to-point segment by default. One MCP wire object may and normally should contain multiple ordered `pointsMm`; use those waypoints to enter a routing lane, travel cleanly, and approach the destination pad in a controlled direction. Do not create electrically duplicated parallel wire objects to imitate segmentation.
- Use short, purposeful orthogonal or 45-degree segments. Prefer two or three meaningful bends over a long staircase. Avoid arbitrary large-angle diagonals across the board.
- Keep each direction change to 45 or 90 degrees where practical. Never make an abrupt turn greater than 90 degrees, a reflex bend, or a near-U-turn at one waypoint; split it into smaller grid-aligned turns or reposition the components.
- Group related nets into clean routing corridors. Keep parallel wires evenly spaced and fan buses out in pin order without crossing them back over one another. Use at least the active grid step, normally 2.54 mm for through-hole layouts, unless verified pad pitch requires tighter routing.
- Do not crowd several routes into nearly the same line. Give every net a readable channel and keep power, ground, analog, digital, and output routing visually separated where practical.
- Except at that wire's own intended starting and ending pads, never place any wire segment above, across, or through a component pad/hole, plated hole, mechanical hole, mounting hole, or component body. Route around the entire footprint and its mounting area. A route crossing a pad can become electrically connected in the editor.
- Leave a short, clean lead-in from each intended endpoint pad before the first bend, and a clean lead-out into the destination pad after the last bend. Do not skim along a row of holes or run through the gap between closely spaced pads.
- Minimize crossings. When a crossing is unavoidable, make it an obvious perpendicular crossing away from pads and bodies; never create an unintended junction.
- Use `layer: "top" | "bottom"` deliberately for two-layer boards. Crossings between opposite copper layers are acceptable; keep same-layer nets from crossing and use through-hole pads as the transition point between layers.
- Avoid tiny stubs and near-zero segments. Do not put consecutive waypoints at the same coordinate.
- Keep wire lengths reasonable: place related parts closer before adding excessive routing.
- Use junctions only where an intentional electrical branch is required. A visual crossing without a junction should stay a crossing.
- Re-read the resulting routes. Confirm endpoints, waypoints, clearances, crossings, and unintended pad contacts. If any region looks tangled, crowded, or ambiguous in circuit, board, or 3D view, re-place components and reroute it.

## Physical-Layout Completion Gate

- Confirm every component footprint is entirely inside the board outline with practical edge clearance.
- Confirm there are zero component-to-component footprint overlaps, including after rotation or mirroring.
- Confirm there are zero wire segments above or through unrelated electrical holes, mechanical holes, mounting holes, component bodies, or mounting areas.
- Confirm every two-component connection uses an intentional routed path with useful waypoints unless the pins are already close, aligned, and the direct segment stays entirely within a clear routing channel.
- Confirm bends use controlled 45/90-degree changes with no abrupt turn greater than 90 degrees or near-U-turn.
- Confirm repeated parts and connectors are aligned intentionally and have usable insertion, screw, display, sensor, and mounting clearance.
- Inspect the whole board at overview scale and the densest areas at close scale. Do not finish while any area looks like a routing tangle.
- SketchForge routing is a visual/electrical layout aid, not a substitute for fabrication DRC, net classes, current-capacity calculations, creepage/clearance rules, thermal analysis, or professional review. Never describe a generated board as fabrication-ready or safe for mains/high-current use without those checks.

## Capture and Visual Inspection

- Call `sketchforge_pcb_capture_board_image` when the PCB itself must be reviewed visually. The command switches to a 2D view, centers and fits the board, crops out the surrounding editor, and returns a PNG image directly to the AI.
- Use `mode: "circuit"` to inspect component placement, labels, and routing. Use `mode: "board"` to inspect the physical board presentation. Optional `paddingPx` controls space around the PCB and `scale` controls image pixel density.
- After meaningful layout or routing work, capture the circuit view and inspect the returned image. Use the image together with `sketchforge_pcb_inspect_design`; neither visual review nor the structured checker replaces the other.
- If the image reveals crowding, poor alignment, unclear routing, clipped geometry, or an unbalanced layout, make targeted in-place edits and capture again before finishing.

## Editing an Existing PCB

- Treat requests to resize, reposition, align, reconfigure, consolidate, or reroute an existing board as in-place edits. Preserve the existing scene and use the targeted editing tools; do not rebuild the design from scratch and do not call `sketchforge_pcb_build_design` with `replaceExisting: true` for these requests.
- Do not pause to ask whether an ordinary, clearly scoped board revision should be rebuilt. Default to the smallest in-place edit that satisfies the request. Ask only when the target editor or a materially different design choice is genuinely ambiguous.
- Keep unaffected components and routes intact. Update the board outline with `sketchforge_pcb_set_board_outline`, move or reconfigure parts with `sketchforge_pcb_update_component`, and replace only the specific wires or obsolete parts that the requested edit makes necessary.
- Use ids returned by `sketchforge_pcb_read_scene`; never invent part or wire ids.
- Use `sketchforge_pcb_update_component` to change position, rotation, footprint, value, colour, or connector settings. Existing wire endpoints follow the component and remap to matching electrical pins when a footprint changes.
- Use `sketchforge_pcb_connect_pins` for one route and `sketchforge_pcb_delete_items` for precise removals.
- Use `sketchforge_pcb_set_board_outline` when only board geometry changes.
- After meaningful changes, inspect again rather than assuming the editor accepted the intended geometry.

## Units and Coordinates

All MCP positions and dimensions use millimeters. Component `xMm`/`yMm` is the component center. Returned pins contain absolute `xMm`/`yMm`; route `pointsMm` contains only intermediate waypoints. Board contours are ordered point arrays and are closed automatically.

## Failure Recovery

If a command fails, call `sketchforge_pcb_inspect_design`, then re-read the scene before retrying. Do not blindly repeat a failed build. Never open a duplicate project tab to recover from an MCP timeout; list editors again and retry against the stable `projectId`, because the bridge heartbeat and delivery lease handle reconnection and command redelivery. If no editors are listed, start the app with `npm run dev` if needed and ask the user to open or refresh their existing PCB project rather than creating another tab.

## Current Editor Limitations

- For now, SketchForge PCB supports component placement on the front/top side only. Do not place components on the backside/bottom side.
- For now, SketchForge PCB does not support drawing or routing wires/traces on the backside/bottom layer. Keep all drawn wire routes on the top layer only, even if a tool schema exposes a bottom layer.
- These current limitations override any earlier guidance in this skill that mentions backside/bottom-layer placement or routing.

