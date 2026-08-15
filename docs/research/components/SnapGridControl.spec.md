# SnapGridControl Specification

## Overview

- **Target file:** `src/components/FunctionalCircuitEditor.tsx`
- **Reference:** user-provided Snap Grid screenshot and read-only SketchForge source
- **Interaction model:** click-to-open menu; click-to-select grid size

## Exact source styles

- Unselected placement: absolute right 12px, bottom 11px.
- Row: flex, center aligned, 8px gap, #435a72, 13px, weight 500, 22px line height.
- Select: 75px × 22px, white background, #d8e0e8 border, 2px radius.
- Menu: right 0, bottom 26px, width 92px, white background, border and shadow.

## Behavior

- Values: 0.5 mm, 1.0 mm, 2.0 mm, and 5.0 mm.
- Default: 1.0 mm.
- Placed parts and junctions snap to the selected grid while dragging or adding.
- The major grid block stays the same physical world size. Choosing a finer snap value adds more minor cells inside that block; choosing a coarser value removes minor cells.
- Grid lines follow the same zoom and pan transform as the circuit geometry.
- When a part is selected, the same control moves into the inspector bottom dock.
