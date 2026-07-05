// ============================================================================
// Chronam — Simulation Engine
// ============================================================================
// Top-level orchestrator that coordinates parsing → testbench generation →
// compilation → simulation → waveform output. This is the main entry point
// used by the VS Code extension to run the full simulation pipeline.
// ============================================================================

import * as path from 'path';
import * as fs from 'fs/promises';
import type {
  SimulationConfig,
  SimulationResult,
  SimulatorId,
  SimulatorInfo,
  VHDLVersion,
} from '@chronam/shared-types';
import type { SimulatorAdapter, SimulationProgressCallback } from './adapter.js';
import { GHDLAdapter } from './ghdl.js';

/** Registry of available simulator adapters */
const ADAPTERS: Record<SimulatorId, () => SimulatorAdapter> = {
  ghdl: () => new GHDLAdapter(),
  modelsim: () => { throw new Error('ModelSim adapter not yet implemented'); },
  verilator: () => { throw new Error('Verilator adapter not yet implemented'); },
};

export class SimulationEngine {
  private adapter: SimulatorAdapter;

  constructor(simulatorId: SimulatorId = 'ghdl', customPath?: string) {
    if (simulatorId === 'ghdl') {
      this.adapter = new GHDLAdapter(customPath);
    } else {
      this.adapter = ADAPTERS[simulatorId]();
    }
  }

  /** Get the current adapter */
  getAdapter(): SimulatorAdapter {
    return this.adapter;
  }

  /** Detect if the configured simulator is available */
  async detectSimulator(customPath?: string): Promise<SimulatorInfo | null> {
    return this.adapter.detect(customPath);
  }

  /**
   * Run the complete simulation pipeline:
   * 1. Write testbench to disk
   * 2. Analyze all source files
   * 3. Elaborate top entity
   * 4. Run simulation
   *
   * @param designSource - Path to the main VHDL design file
   * @param testbenchSource - Generated testbench VHDL source code
   * @param testbenchEntityName - Entity name of the testbench
   * @param config - Simulation configuration
   * @param workDir - Working directory for build artifacts
   * @param onProgress - Progress callback
   */
  async runSimulation(
    designSource: string,
    testbenchSource: string,
    testbenchEntityName: string,
    config: SimulationConfig,
    workDir: string,
    onProgress?: SimulationProgressCallback,
    onOutput?: (stream: 'stdout' | 'stderr', line: string) => void
  ): Promise<SimulationResult> {
    const startTime = Date.now();

    // Clean any stale library files from previous runs
    try {
      const files = await fs.readdir(workDir);
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (['.o', '.cf', '.vcd', '.ghw'].includes(ext)) {
          await fs.unlink(path.join(workDir, file));
        }
      }
    } catch { /* directory may not exist yet */ }

    // Ensure work directory exists
    await fs.mkdir(workDir, { recursive: true });

    // Write testbench to disk
    const tbFilePath = path.join(workDir, `${testbenchEntityName}.vhd`);
    await fs.writeFile(tbFilePath, testbenchSource, 'utf-8');

    const vhdlVersion: VHDLVersion = config.simulator === 'ghdl' ? '2008' : '2008';

    // Phase 1: Analyze design file
    onProgress?.('compiling', `Analyzing ${path.basename(designSource)}`);
    const analyzeDesign = await this.adapter.analyze(
      [designSource],
      workDir,
      vhdlVersion
    );

    if (!analyzeDesign.success) {
      return {
        status: { state: 'failed', errors: analyzeDesign.errors },
        errors: analyzeDesign.errors,
        stdout: analyzeDesign.stdout,
        stderr: analyzeDesign.stderr,
        wallTimeMs: Date.now() - startTime,
      };
    }

    // Phase 2: Analyze testbench
    onProgress?.('compiling', `Analyzing ${testbenchEntityName}.vhd`);
    const analyzeTb = await this.adapter.analyze(
      [tbFilePath],
      workDir,
      vhdlVersion
    );

    if (!analyzeTb.success) {
      return {
        status: { state: 'failed', errors: analyzeTb.errors },
        errors: analyzeTb.errors,
        stdout: analyzeTb.stdout,
        stderr: analyzeTb.stderr,
        wallTimeMs: Date.now() - startTime,
      };
    }

    // Phase 3: Elaborate
    onProgress?.('elaborating', testbenchEntityName);
    const elaborateResult = await this.adapter.elaborate(testbenchEntityName, workDir, vhdlVersion);

    if (!elaborateResult.success) {
      return {
        status: { state: 'failed', errors: elaborateResult.errors },
        errors: elaborateResult.errors,
        stdout: elaborateResult.stdout,
        stderr: elaborateResult.stderr,
        wallTimeMs: Date.now() - startTime,
      };
    }

    // Phase 4: Run simulation
    onProgress?.('running', `Simulating ${testbenchEntityName}`);
    const simResult = await this.adapter.run(testbenchEntityName, config, workDir, vhdlVersion);

    return simResult;
  }

  /** Clean simulation artifacts */
  async clean(workDir: string): Promise<void> {
    await this.adapter.clean(workDir);
  }
}
