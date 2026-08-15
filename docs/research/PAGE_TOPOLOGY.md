# Page topology

## Read-only source

`<local SketchForge 3D checkout>`

The source repository was inspected without edits. The current workspace is a separate implementation.

## Visual order

1. Fixed editor menu ribbon, 120px high.
   - 34px Circuit/Board mode tabs.
   - 86px grouped PCB tools ribbon.
2. White workspace filling the remainder of the viewport.

## Deliberately omitted

- Three.js/WebGL viewport and workplane grid.
- Shape inspector, camera controls, snapping controls, overlays, toasts, and dialogs.
- CAD, circuit editing, sketching, import/export, project persistence, and backend behavior.

The ribbon and its buttons are static. The workspace contains no editor content.

## Current PCB application topology

The application now opens on a local-first SketchForge PCB project home adapted from the official SketchForge repository:

1. Sticky 64px product header with project search and Create.
2. Home sidebar with PCB Guides, Customization, and Settings destinations.
3. Quick-start actions for create, import, and continue.
4. Sortable/searchable grid or list of locally saved PCB projects.
5. The functional Circuit/Board editor replaces the dashboard when a project opens.
6. The editor ribbon Home control returns to the dashboard; project scenes auto-save locally.
