# CircuitWorkspace Specification

## Overview

- **Target file:** `src/components/FunctionalCircuitEditor.tsx`
- **Interaction model:** direct manipulation in a 2D editor

## Structure

- Workspace begins directly below the 120px editor ribbon.
- Subtle cyan Cartesian grid on a near-white canvas.
- SVG connection layer beneath draggable components.
- Components use recognizable schematic symbols, editable references, and values.
- Selection inspector overlays the right side of the workspace.
- Snap Grid occupies the bottom-right corner or inspector dock.

## Behaviors

- Parts can be placed, selected, dragged, copied, pasted, duplicated, deleted, hidden, isolated, flipped, and edited.
- Every newly added part uses the same snapped insertion point at the visible canvas center. Consecutive additions intentionally overlap.
- The mouse wheel zooms around the pointer. Holding the middle mouse button pans from either empty canvas or a component.
- Left-dragging empty canvas creates a SketchForge-style marquee. Shift-click and Shift-marquee add to or toggle the current selection.
- Dragging any member of an existing multi-selection moves the selected parts together while preserving their spacing.
- Align works on two or more selected parts; Distribute works on three or more selected parts.
- Wire mode connects left/right part pins.
- Junction mode places visible snapped junction dots.
- Disconnect removes wires attached to the selected part.
- Net highlights the connected component set.
- Check reports unconnected pins.
- Undo and redo cover scene mutations.
- Import and Export round-trip the editor's JSON scene format.

## Empty state

- Clean centered prompt: Add a part to begin.
- No 3D workplane or 3D editor elements.
