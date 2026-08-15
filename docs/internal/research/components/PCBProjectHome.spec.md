# PCBProjectHome Specification

## Overview

- **Target file:** `src/components/SketchForgePCBApp.tsx`
- **Reference source:** `Formsmith746/SketchForge-3D`, `apps/web/src/app/page.tsx` and dashboard rules in `apps/web/src/app/globals.css` on the `main` branch
- **Interaction model:** click-driven local project dashboard
- **Adaptation:** official SketchForge project-home structure with PCB-specific product name, labels, metadata, project format, and editor handoff

## DOM Structure

1. Full-viewport dashboard shell.
2. Sticky blue top bar with brand, project search, and Create button.
3. Two-column body with sticky navigation sidebar and project content.
4. Three quick-start tiles.
5. Project section with count, sort control, grid/list control, and cards.
6. Project-card overflow menu for rename/delete.
7. Modal confirmation/rename dialogs and a compact settings panel.
8. Existing circuit editor replaces the dashboard after create/open; its Home control returns to the dashboard.

## Computed Styles

### Top bar

- height: 64px
- display: grid
- columns: `minmax(238px, 1fr) minmax(280px, 620px) minmax(210px, 1fr)`
- gap: 28px
- background: `#0e69f1`
- brand size: 20px / 750
- search height: 40px
- create height: 42px

### Sidebar

- width: 158px (official source is 148px; widened for the longer PCB labels)
- top: 64px
- height: `calc(100vh - 64px)`
- padding: 18px 12px
- background: `#ffffff`
- border-right: `1px solid #d9e3ea`
- item height: 42px
- active background: `#edf4ff`
- active color: `#0e69f1`

### Main and quick actions

- main padding: 22px
- three equal columns
- gap: 14px
- tile minimum height: 88px
- tile radius: 8px
- icon tile: 44px square

### Projects

- grid: `repeat(auto-fill, minmax(210px, 1fr))`
- grid gap: 15px
- card padding: 10px
- card radius: 8px
- preview ratio: 16 / 10
- preview artwork: inline vector grid, board, traces, and component marks
- title: 15px / 800
- metadata: 12px

## States & Behaviors

- **Create:** creates an empty browser-local project and opens the editor.
- **Open:** loads the selected project's serialized circuit scene and opens the editor.
- **Auto-save:** scene changes persist to localStorage and refresh component/wire counts plus the modified time.
- **Home:** returns from Circuit or Board mode to the project home without losing the saved scene.
- **Search:** filters project names as the user types.
- **Sort:** switches between recently updated and alphabetical order.
- **View:** switches project cards between responsive grid and compact list.
- **Import:** accepts the JSON format exported by the PCB editor and creates a project.
- **Rename/Delete:** card menu opens the matching modal; delete removes only that browser-local project after confirmation.
- **Continue:** opens the most recently edited project, or creates one if the list is empty.
- **Guides/Customization:** preserve the official sidebar structure with PCB-specific coming-soon panels.

## Text Content

- Brand: `SketchForge PCB`
- Search: `Search PCB projects`
- Actions: `Create new PCB design`, `Open a PCB project`, `Continue latest circuit`
- Sidebar: `Home`, `PCB Guides`, `Customization`, `Settings`
- Metadata units: `components`, `wires`

## Responsive Behavior

- **Desktop:** sticky 158px sidebar and three-column quick actions.
- **Tablet (<=860px):** top bar becomes brand/create plus full-width search; sidebar becomes a horizontal row; quick actions stack.
- **Mobile (<=560px):** sidebar labels collapse to icons, cards become one column, and list previews narrow.

## Assets

- Product mark: Next app icon at `/icon.png`.
- All dashboard icons and project previews are inline SVG; no bitmap UI screenshots are used.
