# Editor behavior

- Circuit and Board switch between workspaces inside the same PCB project.
- Circuit is the source of truth for component placement, component rotation, references, values, and routed connections; Board edits the board outline.
- In Circuit view, pressing R while exactly one component is selected rotates that component by 45 degrees. Wire-only selection does not respond to R.
- The tools ribbon scrolls horizontally when needed and keeps keyboard-focus treatments visible.

## Current PCB project-home behavior

- The initial view is the SketchForge PCB dashboard.
- Create and project-card selection open the existing PCB editor.
- The Home ribbon tool returns to the dashboard from Circuit and Board modes.
- Project scenes auto-save in browser localStorage; cards show current component and wire counts.
- Search filters immediately, sort switches between recent/name, and grid/list changes card layout.
- Import creates a project from the editor's JSON export format.
- Rename and delete require explicit card-menu actions; delete requires confirmation.
