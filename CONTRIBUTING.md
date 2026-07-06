# Contributing to Chronam

Thank you for considering contributing to Chronam! We welcome contributions of all kinds — bug reports, feature requests, documentation, and pull requests.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Guidelines](#coding-guidelines)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

This project adheres to the [Contributor Covenant](https://www.contributor-covenant.org/). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **pnpm** ≥ 8
- **Rust** ≥ 1.81 (for the CLI)
- **GHDL** — installed and on your `PATH`
- **VS Code** ≥ 1.85 (for extension development)

### Setup

```bash
# Fork and clone the repository
git clone https://github.com/your-username/chronam.git
cd chronam

# Install JS/TS dependencies
pnpm install

# Build all monorepo packages
pnpm build

# Build the Rust CLI
cargo build --manifest-path packages/cli/Cargo.toml
```

## Project Structure

```
chronam/
├── packages/
│   ├── cli/                  # Rust CLI (standalone binary)
│   │   ├── src/
│   │   │   ├── commands/     # Subcommand implementations (12 commands)
│   │   │   ├── engine/       # GHDL adapter
│   │   │   ├── output/       # Styled terminal output
│   │   │   └── project/      # chronam.toml config model
│   │   └── tests/            # Integration tests
│   ├── core/                 # Editor-agnostic orchestration
│   ├── shared-types/         # TypeScript interfaces
│   ├── simulation-engine/    # GHDL orchestration (TS)
│   ├── vhdl-parser/          # VHDL entity/port parser
│   ├── vcd-parser/           # IEEE 1364 VCD parser
│   ├── testbench-generator/  # Testbench scaffolding
│   ├── wave-renderer/        # Canvas 2D waveform engine
│   └── wave-viewer/          # React + Zustand webview
├── tools/
│   └── fixtures/             # Test VHDL designs
├── .github/                  # CI/CD workflows
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

## Development Workflow

### VS Code Extension

1. Open the repository root in VS Code.
2. Press `F5` to launch the Extension Development Host.
3. Make changes to packages — Turborepo handles incremental builds.

### Rust CLI

All CLI work happens in `packages/cli/`:

```bash
cd packages/cli

# Build
cargo build

# Run (with a fixture project)
cargo run -- build ../../tools/fixtures

# Run tests
cargo test

# Check for warnings
cargo clippy -- -D warnings
```

Use the fixture counter for manual testing:

```bash
cd tools/fixtures
../../packages/cli/target/debug/chronam.exe build
../../packages/cli/target/debug/chronam.exe simulate
../../packages/cli/target/debug/chronam.exe test
../../packages/cli/target/debug/chronam.exe clean
```

### Adding a New CLI Command

1. Create `packages/cli/src/commands/<name>.rs` with an `Args` struct and a `run` function.
2. Register it in `packages/cli/src/commands/mod.rs`.
3. Add a variant in `packages/cli/src/cli.rs` `Commands` enum.
4. Add the dispatch in `Cli::run()`.
5. Add integration tests in `packages/cli/tests/cli.rs`.

### Adding a New Simulator Backend

1. Create `packages/simulation-engine/src/adapters/<name>.ts`.
2. Implement the `SimulatorAdapter` interface.
3. Register it in the adapter map.
4. Add tests.

## Coding Guidelines

### TypeScript / JavaScript

- Strict TypeScript mode (`strict: true`).
- Use `shared-types` interfaces for cross-package communication.
- Follow conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`.

### Rust

- Edition 2024.
- Zero `unwrap()` — use `?`, `context()`, or `match`.
- Zero `unsafe` code.
- Use `anyhow::Result` for fallible functions.
- Use `crate::output` module for all terminal I/O — never `println!` or `eprintln!` directly (with rare exceptions).
- Every `Args` struct gets `#[derive(Args, Debug)]`.
- Every command public API is `pub fn run(args: &Args, cli: &Cli) -> Result<()>`.
- Commands that exit early use `error_()` + `std::process::exit(1)`, never `bail!()` for user-facing errors.

### General

- Keep packages loosely coupled — prefer interfaces over direct imports.
- Add tests for new functionality.
- Keep error messages actionable — tell the user *what* went wrong and *how to fix it*.

## Testing

```bash
# Run all JS/TS tests
pnpm test

# Run Rust CLI tests
cd packages/cli && cargo test

# Run a specific CLI test
cd packages/cli && cargo test test_build_and_clean

# Build everything (must pass before PR)
pnpm build
cd packages/cli && cargo build
```

## Pull Request Process

1. Ensure all CI checks pass (build + test + lint).
2. Update documentation if you change public APIs.
3. Add a clear description of what the PR does and why.
4. Reference any related issues (e.g., `Closes #123`).
5. Request review from a maintainer.
6. Squash commits before merging.

## Reporting Issues

Please include:

- **OS** and version (Windows 11, Ubuntu 24.04, macOS 14, etc.)
- **VS Code** version (if applicable)
- **GHDL** version (`ghdl --version`)
- **Chronam** version (`chronam --version` or extension version)
- The **VHDL file** causing the issue (minimal reproducer preferred)
- **Error messages** from the Chronam output channel or terminal
- Steps to reproduce

---

Thank you for helping make Chronam better!
