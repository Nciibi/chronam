# Chronam — Development Guide

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| **Node.js** | ≥18.0 | Runtime |
| **pnpm** | ≥8.0 | Package manager (workspace support) |
| **GHDL** | ≥4.0 | VHDL simulation (for integration testing / real usage) |

### Installing GHDL

**Windows:** Download from [github.com/ghdl/ghdl/releases](https://github.com/ghdl/ghdl/releases) and add to `PATH`.

**macOS:** `brew install ghdl`

**Linux (Debian/Ubuntu):** `sudo apt install ghdl`

Verify: `ghdl --version`

---

## Getting Started

```bash
# Clone the repository
git clone https://github.com/Nciibi/chronam.git
cd chronam

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test
```

---

## Monorepo Structure

```
chronam/
├── apps/
│   └── vscode-extension/     # VS Code extension entry point
├── packages/
│   ├── shared-types/          # Cross-package TypeScript interfaces
│   ├── vhdl-parser/           # Regex-based VHDL entity/port extractor
│   ├── testbench-generator/   # Automatic testbench VHDL generation
│   ├── simulation-engine/     # GHDL adapter + process runner
│   ├── vcd-parser/            # VCD waveform file parser
│   ├── wave-renderer/         # Canvas-based waveform rendering engine
│   ├── wave-viewer/           # React webview app (Vite + Zustand)
│   └── core/                  # Orchestration layer (editor-agnostic)
├── tools/
│   └── fixtures/              # Test VHDL files and VCD samples
└── docs/
```

### Dependency Graph

```
shared-types ← vhdl-parser ← testbench-generator
             ← vcd-parser
             ← simulation-engine
             ← wave-renderer
             ← wave-viewer (React)
             ← core (orchestrates all of the above)
             ← vscode-extension (uses core + wave-viewer)
```

---

## Development Workflow

### Building

```bash
# Build everything (uses Turborepo for caching)
pnpm build

# Build a single package
cd packages/vhdl-parser && pnpm build

# Watch mode for extension development
cd apps/vscode-extension && pnpm dev
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests for a single package
cd packages/vhdl-parser && pnpm test

# Watch mode
cd packages/vhdl-parser && pnpm test:watch
```

Tests use **Vitest**. Test files live alongside source in `src/__tests__/`.

### Running the Extension Locally

1. `pnpm build` from the root
2. Open the repo in VS Code
3. Press `F5` to launch the Extension Development Host
4. Open a `.vhd` file and use `Ctrl+Shift+P` → "Chronam: Run Simulation"

### Building the Wave Viewer

The wave viewer is a React app built with Vite. During development:

```bash
cd packages/wave-viewer
pnpm dev     # Starts Vite dev server (for standalone testing)
pnpm build   # Builds the production bundle loaded by the extension
```

The extension loads the built bundle from `packages/wave-viewer/dist/`.

---

## Key Design Decisions

1. **Regex parser first, tree-sitter later.** The VHDL parser uses regex for Phase 1. It's isolated behind a clean interface so it can be swapped for tree-sitter-vhdl without affecting consumers.

2. **Delegate pattern for core orchestration.** The `@chronam/core` package uses a delegate interface (`OrchestratorDelegate`) so the simulation pipeline logic is editor-agnostic. The VS Code extension implements the delegate to wire in VS Code APIs.

3. **React webview with Zustand.** The wave viewer is a standalone React app that communicates with the extension host via `postMessage`. State is managed with Zustand for simplicity.

4. **Canvas rendering.** Waveforms are rendered directly to an HTML5 Canvas for performance with many signals. The renderer supports virtual scrolling and zoom/pan.

---

## Adding a New Package

1. Create `packages/<name>/` with `package.json`, `tsconfig.json`, and `src/index.ts`
2. Set `"name": "@chronam/<name>"` in `package.json`
3. Add `"@chronam/shared-types": "workspace:*"` to dependencies if needed
4. Run `pnpm install` from the root
5. Add the package to any consumers' `package.json` dependencies
