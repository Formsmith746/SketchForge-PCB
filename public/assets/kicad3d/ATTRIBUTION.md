# KiCad 3D models

The `.wrl` assets in this directory are copied from the official KiCad 3D model library. Newly added
LED, display, sensor, male-header, and female-header assets use the official `9.0.4` library tag.

- Project: KiCad 3D Models
- Source: https://gitlab.com/kicad/libraries/kicad-packages3D
- License: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)

The component pad positions and drill sizes are transcribed from the matching official KiCad footprint
files in https://gitlab.com/kicad/libraries/kicad-footprints.

## Rendering policy

The 3D viewer renders component geometry only when a matching model copied from the official KiCad
`kicad-packages3D` repository is present in this directory. SketchForge does not substitute procedural,
handmade, manufacturer-inspired, or placeholder component meshes. A placed component without a
verified KiCad model remains visible in the 2D editor, leaves its correctly positioned PCB holes or pads,
and is reported as unsupported in the 3D viewer.
