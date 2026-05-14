# WaveForge ⚡

**The modern VHDL development environment for VS Code.**

WaveForge replaces the painful UX of legacy HDL tools with a fast, visual, cross-platform experience. Write VHDL, press Run, see waveforms — all inside VS Code.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-green.svg)

---

## ✨ Features

- **One-Click Simulation** — Press ▶ to parse, compile, simulate, and view waveforms
- **Entity Detection** — Automatically parses VHDL entities, ports, and architectures
- **Testbench Generation** — Auto-generates testbenches with clock/reset detection
- **GHDL Integration** — Seamless compilation and simulation via GHDL
- **Waveform Viewer** — Canvas-based viewer with zoom, pan, cursors, and signal labels
- **Error Translation** — Converts cryptic GHDL errors into human-readable messages
- **CodeLens Actions** — Inline "▶ Run" and "📝 Generate Testbench" above entities

## 🚀 Quick Start

### Prerequisites

1. **VS Code** ≥ 1.85.0
2. **GHDL** installed and on your PATH
   - **Linux**: `sudo apt install ghdl` or [build from source](https://github.com/ghdl/ghdl)
   - **Windows**: Download from [GHDL releases](https://github.com/ghdl/ghdl/releases)

### Install

```bash
# Clone and build
git clone https://github.com/waveforge/waveforge.git
cd waveforge
pnpm install
pnpm build

# Launch in VS Code
code apps/vscode-extension
# Press F5 to run Extension Development Host
```

### Usage

1. Open a VHDL file (`.vhd` or `.vhdl`)
2. Click **▶ Run Simulation** above the entity declaration (CodeLens)
3. Or use Command Palette: `WaveForge: Run Simulation`
4. View waveforms in the Wave Viewer panel

## 📦 Project Structure

```
waveforge/
├── apps/
│   └── vscode-extension/    # VS Code extension
├── packages/
│   ├── shared-types/        # TypeScript type definitions
│   ├── vhdl-parser/         # VHDL entity/port extraction
│   ├── vcd-parser/          # VCD waveform file parser
│   ├── testbench-generator/ # Auto testbench generation
│   ├── simulation-engine/   # GHDL adapter & orchestration
│   └── wave-renderer/       # Canvas waveform renderer
├── tools/
│   └── fixtures/            # Sample VHDL files
└── docs/
```

## 🛠️ Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Watch mode
pnpm dev
```

## 🗺️ Roadmap

| Phase | Features | Status |
|-------|----------|--------|
| **1** | Core simulation pipeline, VCD parsing, basic waveform viewer | 🔨 In Progress |
| **2** | Interactive controls, signal grouping, zoom/pan improvements | 📋 Planned |
| **3** | FSM visualization, timing cursors, enhanced diagnostics | 📋 Planned |
| **4** | AI-assisted debugging, Verilog support, remote simulation | 📋 Future |

## 📄 License

MIT — see [LICENSE](LICENSE).
