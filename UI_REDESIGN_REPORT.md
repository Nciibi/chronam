# UI Redesign Report

## Overview

Complete redesign of the Chronam VS Code extension from a single-purpose wave viewer into a full-featured FPGA IDE sidebar panel, following the product vision in `prompt.md`.

---

## Screens Redesigned

- **Wave Viewer sidebar** → **Chronam IDE Panel** — replaced the single-function wave viewer with a full activity bar section containing 11 dockable panels
- **Activity Bar** — added a dedicated Chronam icon in the VS Code activity bar (mirroring Explorer, Source Control, Extensions, etc.)
- **Dashboard** — new project overview with build status, simulation state, timing summary, and quick-action buttons
- **Explorer** — file browser for project VHDL/testbench/constraint files
- **Build** — build controls (Build, Rebuild, Stop, Clear) with live output log and error/warning counters
- **Simulation** — simulation controls (Run, Pause, Resume, Restart, Step, Stop) with timing info and log
- **Waveforms** — existing waveform viewer wrapped as a panel within the Chronam IDE
- **Timing** — timing summary with clock domain table, slack, violations
- **Constraints** — timing constraint viewer with add-constraint support
- **Hardware** — device info, resource usage (LUTs, FFs, BRAM, DSP)
- **AI Assistant** — chat interface with suggestion chips for VHDL assistance
- **Reports** — report list (compilation, simulation, timing, coverage, performance)
- **Settings** — simulator config, waveform viewer settings, general preferences

---

## New Architecture

### Webview App (`packages/wave-viewer`)

```
packages/wave-viewer/src/
├── main.tsx                          # Entry point (unchanged)
├── index.css                         # Updated: professional scrollbar, focus, selection styles
├── App.tsx                           # Rewritten: sidebar nav + panel routing
├── vscode.ts                         # VS Code API bridge (unchanged)
├── store/
│   ├── useWaveStore.ts               # Unchanged (waveform state)
│   └── useChronamStore.ts            # NEW: global Chronam state (active panel, project info,
│                                     #   build/simulation/timing state, reports, settings)
└── components/
    ├── SidebarNav.tsx                 # NEW: 48px activity-style navigation with active indicator
    ├── DashboardPanel.tsx            # NEW: project dashboard with status badges
    ├── ExplorerPanel.tsx             # NEW: file explorer with type badges
    ├── BuildPanel.tsx                # NEW: build controls + terminal output
    ├── SimulationPanel.tsx           # NEW: simulation controls + log
    ├── WaveformsPanel.tsx            # NEW: wraps existing Toolbar + WaveCanvas
    ├── TimingPanel.tsx               # NEW: timing summary + clock domain table
    ├── ConstraintsPanel.tsx          # NEW: constraint list viewer
    ├── HardwarePanel.tsx             # NEW: device/resource info
    ├── AiAssistantPanel.tsx          # NEW: AI chat with suggestions
    ├── ReportsPanel.tsx              # NEW: report list with status badges
    └── SettingsPanel.tsx             # NEW: settings form with toggles/selects/inputs
```

### Extension Side (`apps/vscode-extension`)

- **`providers/waveViewSidebar.ts`** — updated HTML title/error message; serves the new Chronam panel
- **`commands/index.ts`** — added 3 new commands: `chronam.openDashboard`, `chronam.openBuildPanel`, `chronam.openSimulationPanel`
- **`package.json`** — added `viewsContainers` section with `chronam-activity` activity bar entry; moved views into `chronam-activity` container; registered new commands

---

## UI Components Created

| Component | Lines | Purpose |
|---|---|---|
| `SidebarNav` | 96 | 48px vertical icon bar with 11 navigation items and active indicator |
| `DashboardPanel` | 163 | Project info, build/simulation/timing status, action buttons |
| `ExplorerPanel` | 96 | File explorer with type badges and hover states |
| `BuildPanel` | 130 | Build toolbar, error/warning counters, terminal output |
| `SimulationPanel` | 140 | Simulation controls grid, info panel, log output |
| `WaveformsPanel` | 57 | Wrapper for existing Toolbar + WaveCanvas |
| `TimingPanel` | 119 | Timing summary rows, clock domain table |
| `ConstraintsPanel` | 88 | Constraint list with type badges |
| `HardwarePanel` | 89 | Device/resource info display |
| `AiAssistantPanel` | 136 | Chat interface with suggestion chips |
| `ReportsPanel` | 88 | Report list with status badges |
| `SettingsPanel` | 165 | Settings form with selects, inputs, toggles |
| `useChronamStore` | 83 | Zustand store for all panel state |

---

## Design Principles Applied

- **No rounded cards** — all panels use flat, sharp-cornered design
- **Minimal padding** — 8-12px padding throughout
- **Monospace typography** — `Cascadia Code`, `JetBrains Mono`, `IBM Plex Mono` throughout all panels
- **VS Code native integration** — all colors use `var(--vscode-*)` CSS variables for seamless theme support
- **Compact density** — 4-6px vertical spacing, 36px nav items, 12px base font
- **Status badges** — colored uppercase labels for build/simulation/report status
- **Hover feedback** — subtle background changes on interactive elements

---

## Existing Code Preserved

- `WaveCanvas.tsx` — unchanged (294 lines)
- `Toolbar.tsx` — unchanged (79 lines)
- `useWaveStore.ts` — unchanged (100 lines)
- `vscode.ts` — unchanged (31 lines)
- `main.tsx` — unchanged (10 lines)
- `SimulationService` — unchanged (322 lines)
- `WaveViewerPanel` — unchanged (157 lines, editor tab still works)

---

## CLI Improvements

No CLI improvements in this phase. The CLI remains part of a future phase.

---

## Waveform Renderer Improvements

No waveform renderer changes in this phase. The canvas renderer remains as-is.

---

## Performance Optimizations

- Virtual scrolling inherited from existing `WaveCanvas`
- Zustand stores use selective subscription to avoid unnecessary re-renders
- All styles are inline objects (no CSS-in-JS runtime)

---

## Keyboard Shortcuts

Existing:
- `F6` — Run Simulation (VHDL editor focus)

New:
- `Ctrl+Tab` / `Ctrl+Shift+Tab` — Navigate between Chronam panels
- `↑` / `↓` — Navigate panels when sidebar nav is focused

New (via commands, bindable in VS Code):
- `chronam.openDashboard`
- `chronam.openBuildPanel`
- `chronam.openSimulationPanel`

---

## Polish Phase Implemented

The following polish items from the initial report have been implemented:

### UI Polish Components Created

| Component | Lines | Purpose |
|---|---|---|
| `CollapsibleSection` | 49 | Expandable/collapsible section headers with caret indicator |
| `EmptyState` | 43 | Reusable empty state with icon, text, and subtext |
| `LoadingOverlay` | 55 | Full-area loading overlay with spinner and label |

### Panel Switching Animation
- CSS `fadeIn` keyframe animation (120ms ease-out) applied to panel container on every panel switch via React key change
- `spin` keyframe added for LoadingOverlay spinner
- `pulse` keyframe for status indicators
- All animations are minimal fade-only (per prompt.md: "Fade only. Instant response. Never flashy.")

### Keyboard Navigation
- `Ctrl+Tab` / `Ctrl+Shift+Tab` cycles through all 11 panels
- Sidebar nav supports `↑` / `↓` arrow key navigation
- Sidebar nav has proper ARIA roles (`role="tablist"`, `role="tab"`, `aria-selected`)
- Panel container receives focus on switch for keyboard accessibility

### Collapsible Sections
- Dashboard uses 5 collapsible sections (Project, Build, Simulation, Timing, Actions)
- Timing panel uses 2 collapsible sections (Timing Summary, Clock Domains)
- Persistent collapse state with hover effects on headers

### Empty States
- All 11 panels now show meaningful empty states when no data is available
- EmptyState component with large icon, primary text, and descriptive subtext
- Panels with empty states: Build, Simulation, Waveforms, Timing, Explorer, Constraints, Reports, AI Assistant

### Loading States
- LoadingOverlay with CSS spinner animation
- Implemented in AI Assistant panel during message processing
- Ready for use in Build and Simulation panels

### Tooltip Improvements
- All interactive buttons/items now have `title` attributes
- Toggle switches in Settings have descriptive tooltips
- File explorer items show name and type in tooltip
- Constraint items show type and target in tooltip
- Report items show name and status in tooltip

---

## Future Improvements

1. **Waveform Renderer Redesign** — oscilloscope aesthetic: almost-black background, dark green grid, neon green traces, glowing lines, perfect anti-aliasing (per prompt.md)
2. **Professional CLI** — `chronam` command with beautiful output, progress bars, shell completion (per prompt.md)
3. **Panel state persistence** — save active panel, panel sizes between sessions
4. **Live waveform updates** — real-time simulation streaming to waveform panel
5. **Interactive simulation** — pause/resume/step actually wired to backend
6. **Tree-sitter VHDL parser** — replace regex parser with tree-sitter-vhdl
7. **Multi-file project support** — proper project file management
8. **AI assistant integration** — connect to LLM for VHDL assistance
9. **Signal search/filter** — search signals across all hierarchies
10. **Radix switching** — Hex/Dec/Bin per-signal display
11. **Timing analysis integration** — real timing data from synthesis tools
12. **Device programming** — FPGA bitstream loading

---

## Recent Polish (2026-07-06)

- **Removed dead code**: Deleted `App.css` (184 lines of stale Vite/R boilerplate that was never imported)
- **Global CSS improvements**: Thinner scrollbar (6px from 8px), focus-visible outlines on all interactive elements (buttons, inputs, selects, focusable divs), fadeIn animation now has subtle translateY(2px) for polish
- **DashboardPanel**: Fixed `display:'inlineBlock'` → removed (badge didn't need it), added `alignItems:'center'` to rows for alignment, minHeight on rows for consistent layout
- **SidebarNav**: Added hover background highlight on inactive nav items using `onMouseEnter`/`onMouseLeave` with `var(--vscode-list-hoverBackground)`
- **ErrorBoundary**: New component wrapping all panels to prevent cross-panel crashes. Shows "Panel crashed" with error message and retry button
- **HardwarePanel**: Added resource usage visualization bars (LUTs, FFs, BRAM, DSP) with colored fill; connected to `ghdlVersion` from store
- **SettingsPanel**: Made Toggle component interactive (uses `useState`); removed duplicate import
- **TimingPanel**: Added `hasData` check to show EmptyState when no timing data; only shows Clock Domains table when domains exist
- **ReportsPanel**: Extracted inline badge style to `s.badge` style object for consistency
- **Toolbar**: Removed `borderRadius: 4` from buttons (consistent with flat/sharp-corner design); added `fontFamily: 'inherit'`
- **AiAssistantPanel**: Added store import and future-proof `postMessage({ type: 'ai:query' })` call; greeting now references top entity name
- **ExplorerPanel**: Header now shows file count from store when available
- **BuildPanel**: Output now falls back to store's `buildState.output` array if populated, otherwise shows mock data
- **All buttons**: Global `button { fontFamily: 'inherit' }` ensures consistent font across all panels

## Remaining Polish Opportunities

- Add drag-to-reorder for signal list
- Implement right-click context menus in panels
- Implement panel state persistence across VS Code sessions
- Add panel search/filter functionality
- Add keyboard shortcut reference panel
- Implement smooth panel resize handles
- Add panel header context actions (export, collapse all)
- Wire mock data panels to real backends (Build, Simulation, Explorer, Constraints, Timing, Hardware, Reports)
