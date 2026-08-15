# ComponentInspector Specification

## Overview

- **Target file:** `src/components/FunctionalCircuitEditor.tsx`
- **Reference:** read-only SketchForge `ShapeInspector.tsx` and v0.8.0 editor screenshot
- **Interaction model:** appears on selection; form-driven editing

## Source placement and styles

- Workspace-relative absolute panel: top 0, right 0, bottom 0.
- Width: 320px.
- Background: rgba(244, 246, 248, 0.96).
- Left border: 1px solid #d8e0e7.
- Shadow: -2px 0 10px rgba(36, 61, 86, 0.08).
- Header: 50px high with white translucent background and bottom border.
- Header title: 18px, weight 800.
- Inspector scrollbars are hidden.

## PCB adaptation

- No Length, Width, or Height fields.
- Editable fields: Reference, component-specific Value, and Footprint.
- Resistive components use a numeric value plus an explicit Ω, kΩ, MΩ, or GΩ selector.
- The resistor's four colour bands update from the selected resistance and unit.
- Read-only metadata: category and KiCad-compatible library symbol identifier.
- Snap Grid is docked to the bottom of the inspector, matching SketchForge.

## Responsive behavior

- Desktop: 320px right panel.
- Mobile: inset floating panel, leaving a narrow canvas strip visible.
