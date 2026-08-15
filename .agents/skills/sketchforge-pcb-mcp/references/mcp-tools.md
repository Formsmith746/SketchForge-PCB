# SketchForge PCB MCP Tools

The server targets any open local editor. Call `sketchforge_pcb_list_editors` first and prefer the returned stable `projectId` for later calls. Duplicate tabs for the same project are consolidated and commands are routed to the healthiest live connection. The 5-digit `editorNumber` remains available for human-directed targeting.

## Read tools

- `sketchforge_pcb_list_editors({})`: returns editor number, project id/name, URL, focus, current mode, counts, notice, and last error.
- `sketchforge_pcb_read_scene({ editorNumber })`: returns the complete scene in millimeters. Each part includes exact absolute pin coordinates. Each wire includes endpoint ids, intermediate `pointsMm`, and the full resolved `routeMm`.
- `sketchforge_pcb_list_components({ editorNumber })`: returns the live component catalog, every footprint's exact size/pads, and customization ranges.
- `sketchforge_pcb_inspect_design({ editorNumber })`: returns duplicate references, invalid endpoints, open pins, component overlaps, parts outside the board, routes through unrelated component bodies, board state, notice, and the last MCP error.
- `sketchforge_pcb_capture_board_image({ editorNumber, mode?, paddingPx?, scale? })`: fits and centers the PCB in the live 2D editor, crops to the board, and returns a PNG image plus capture metadata. `mode` is `circuit` or `board`; defaults are circuit mode, 24 px padding, and 1x scale.

## Component tools

`sketchforge_pcb_add_component` requires `kind`, `xMm`, and `yMm`. Optional fields are `reference`, `value`, `footprint`, `rotation`, `mirrored`, and `hidden`. For `pin-header`, also use `gender: "male" | "female"` and `pinCount: 1..40`.

`sketchforge_pcb_update_component` requires `partId` and accepts the same configurable fields. Position is the component center. Use exact footprint names returned by the catalog.

`sketchforge_pcb_select_items` accepts `partIds`, optional `wireId`, and optional `junctionId`.

`sketchforge_pcb_delete_items` accepts arrays `partIds`, `wireIds`, and `junctionIds`. Deleting a component also deletes its attached wires.

## Wiring tools

`sketchforge_pcb_connect_pins` requires:

```json
{
  "editorNumber": 12345,
  "from": { "partId": "part-id", "pinId": "1" },
  "to": { "partId": "other-part-id", "pinId": "2" },
  "pointsMm": [{ "xMm": 30.48, "yMm": 17.78 }],
  "color": "#2f9e44",
  "layer": "top"
}
```

`pointsMm` contains intermediate waypoints only. An empty array makes a straight route. Read absolute pin coordinates first. `layer` is `top` or `bottom` and defaults to `top`; use the bottom layer deliberately when a compact two-layer layout cannot remain planar on one side. Standard colours include green `#2f9e44`, red `#d83b32`, black `#33383c`, blue `#2878c7`, yellow `#d4a500`, orange `#e87924`, brown `#7c4a2d`, and purple `#7c58b5`.

`sketchforge_pcb_add_junction` requires `xMm` and `yMm`. Use it only for intentional electrical branches.

## Board and view tools

`sketchforge_pcb_set_board_outline` accepts `outer`, optional `cutout`, and optional `thicknessMm` from 0.2 to 5. Each contour is an ordered array of `{xMm,yMm}` points with at least three points; closure is automatic. Only one inner cutout is supported and it must be strictly inside the outer board.

`sketchforge_pcb_set_mode` switches to `circuit`, `board`, or `3d`.

Use `sketchforge_pcb_capture_board_image` instead of a whole-window screenshot when the AI needs to inspect the PCB itself. The tool changes the live editor to the requested 2D mode and leaves the board centered after capture.

## Atomic complete build

Use `sketchforge_pcb_build_design` to create a full design in one history entry. Give each new component a unique `key`; wire endpoints refer to that key through `component`.

```json
{
  "editorNumber": 12345,
  "replaceExisting": true,
  "board": {
    "outer": [
      { "xMm": 0, "yMm": 0 },
      { "xMm": 70, "yMm": 0 },
      { "xMm": 70, "yMm": 45 },
      { "xMm": 0, "yMm": 45 }
    ],
    "thicknessMm": 1.6
  },
  "components": [
    { "key": "supply", "kind": "battery", "footprint": "9V Clip", "value": "9 V", "reference": "BT1", "xMm": 12, "yMm": 20 },
    { "key": "led", "kind": "led", "footprint": "LED 5 mm", "value": "Green", "reference": "D1", "xMm": 55, "yMm": 20 },
    { "key": "r", "kind": "resistor", "footprint": "Axial DIN0207", "value": "330 Ω", "reference": "R1", "xMm": 36, "yMm": 15 },
    { "key": "out", "kind": "pin-header", "gender": "female", "pinCount": 4, "reference": "J1", "xMm": 58, "yMm": 34 }
  ],
  "wires": [
    {
      "from": { "component": "supply", "pinId": "1" },
      "to": { "component": "r", "pinId": "1" },
      "pointsMm": [{ "xMm": 24, "yMm": 12.7 }, { "xMm": 30, "yMm": 12.7 }],
      "color": "#d83b32"
    },
    {
      "from": { "component": "r", "pinId": "2" },
      "to": { "component": "led", "pinId": "2" },
      "pointsMm": [{ "xMm": 48, "yMm": 12.7 }],
      "color": "#d83b32"
    }
  ],
  "junctions": []
}
```

`component` may also be an existing part id when adding a route to an existing design. `replaceExisting` defaults to false.
