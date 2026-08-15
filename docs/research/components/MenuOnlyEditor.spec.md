# MenuOnlyEditor specification

## Overview

- **Target file:** `src/components/MenuOnlyEditor.tsx`
- **Visual basis:** the original SketchForge toolbar plus generated PCB-specific icon artwork
- **Interaction model:** static presentation only

## Structure

- Full-viewport editor shell.
- Fixed 120px top ribbon.
  - Circuit and Board mode tabs.
  - Ten grouped PCB tool sections in an 86px tool strip.
- Blank white workspace below the ribbon.

## Ribbon groups

1. Home: Home
2. Clipboard: Copy, Paste, Duplicate, Delete
3. History: Undo, Redo
4. Components: Add Part
5. Connect: Wire, Junction, Disconnect
6. Visibility: Hide/Show, Isolate
7. Modify: Flip
8. Arrange: Align, Distribute, Snap/Grid
9. Inspect: Net, Check
10. Manage: Import, Export, Settings

## Styling

- SketchForge pearl-gray gradient ribbon and steel-blue typography.
- Circuit is presented as the selected mode with the existing cyan underline.
- Compact artwork-and-label controls retain the source toolbar proportions.
- A flexible blank spacer after Components mirrors the source gap after Shapes and pushes Connect through Manage to the right.
- The ribbon scrolls horizontally when the viewport cannot contain every group.
- The workspace is pure white and contains no 3D editor, grid, panels, or controls.

## Assets

- Existing SketchForge artwork is reused for matching commands.
- Twelve PCB-specific icons live in `public/assets/pcb`.
- Their original chroma-key generations are preserved in `public/assets/pcb/generated-source`.
