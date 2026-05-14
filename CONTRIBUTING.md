# Contributing to WaveForge

Thank you for considering contributing to WaveForge! We welcome contributions of all kinds.

## Development Setup

1. **Prerequisites**: Node.js ≥ 18, pnpm ≥ 8, VS Code ≥ 1.85, GHDL
2. Clone the repo and run `pnpm install`
3. Run `pnpm build` to build all packages
4. Open `apps/vscode-extension` in VS Code and press F5

## Architecture

WaveForge is a monorepo with the following packages:

- `shared-types` — TypeScript interfaces shared across all packages
- `vhdl-parser` — Parses VHDL source to extract entities, ports, architectures
- `vcd-parser` — Parses VCD waveform files into structured data
- `testbench-generator` — Generates testbench VHDL from entity definitions
- `simulation-engine` — Orchestrates GHDL compilation and simulation
- `wave-renderer` — Canvas 2D waveform rendering engine
- `vscode-extension` — VS Code extension entry point

## Guidelines

- Write TypeScript with strict mode
- Add tests for new parser/engine functionality
- Keep packages loosely coupled through shared-types interfaces
- Use the adapter pattern for new simulator backends
- Follow conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`

## Adding a New Simulator

1. Create a new file in `packages/simulation-engine/src/adapters/`
2. Implement the `SimulatorAdapter` interface
3. Register it in the adapter map in `engine.ts`
4. Add tests

## Reporting Issues

Please include:
- OS and VS Code version
- GHDL version (`ghdl --version`)
- The VHDL file causing the issue
- Error messages from the WaveForge output channel
