// ============================================================================
// WaveForge — Simulator Adapter Interface
// ============================================================================
// Abstract interface for simulator backends. Implement this to add support
// for new simulators (GHDL, ModelSim, Verilator, etc.).
// ============================================================================

import type {
  SimulatorId,
  SimulatorInfo,
  SimulationConfig,
  SimulationResult,
  CompileResult,
  SimulationError,
  VHDLVersion,
} from '@waveforge/shared-types';

/**
 * Interface that all simulator adapters must implement.
 * Each adapter wraps a specific simulator CLI tool.
 */
export interface SimulatorAdapter {
  /** Unique identifier for this simulator */
  readonly id: SimulatorId;

  /** Human-readable name */
  readonly name: string;

  /**
   * Check if the simulator is available on the system.
   * Returns info if found, null if not installed/accessible.
   */
  detect(customPath?: string): Promise<SimulatorInfo | null>;

  /**
   * Analyze (compile) VHDL source files.
   * @param sources - Absolute paths to VHDL source files
   * @param workDir - Working directory for intermediate files
   * @param vhdlVersion - VHDL standard version to use
   */
  analyze(
    sources: string[],
    workDir: string,
    vhdlVersion?: VHDLVersion
  ): Promise<CompileResult>;

  /**
   * Elaborate the top-level design entity.
   * @param topEntity - Name of the top-level entity
   * @param workDir - Working directory
   */
  elaborate(topEntity: string, workDir: string): Promise<CompileResult>;

  /**
   * Run a simulation and produce a waveform output file.
   * @param topEntity - Name of the top-level entity to simulate
   * @param config - Simulation parameters
   * @param workDir - Working directory
   */
  run(
    topEntity: string,
    config: SimulationConfig,
    workDir: string
  ): Promise<SimulationResult>;

  /**
   * Parse a raw error string from the simulator into a structured error.
   */
  translateError(raw: string): SimulationError | null;

  /**
   * Clean all intermediate files in the work directory.
   */
  clean(workDir: string): Promise<void>;
}

/**
 * Progress callback for long-running simulation operations.
 */
export type SimulationProgressCallback = (
  phase: 'compiling' | 'elaborating' | 'running',
  detail: string
) => void;
