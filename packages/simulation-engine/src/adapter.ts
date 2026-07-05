// ============================================================================
// Chronam — Simulator Adapter Interface
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
} from '@chronam/shared-types';

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
   * @param onStderr - Callback for each stderr line (for real-time terminal output)
   */
  analyze(
    sources: string[],
    workDir: string,
    vhdlVersion?: VHDLVersion,
    onStderr?: (line: string) => void
  ): Promise<CompileResult>;

  /**
   * Elaborate the top-level design entity.
   * @param topEntity - Name of the top-level entity
   * @param workDir - Working directory
   * @param vhdlVersion - VHDL standard version (must match analyze step)
   * @param onStderr - Callback for each stderr line
   */
  elaborate(topEntity: string, workDir: string, vhdlVersion?: VHDLVersion, onStderr?: (line: string) => void): Promise<CompileResult>;

  /**
   * Run a simulation and produce a waveform output file.
   * @param topEntity - Name of the top-level entity to simulate
   * @param config - Simulation parameters
   * @param workDir - Working directory
   * @param vhdlVersion - VHDL standard version (must match analyze step)
   * @param onStderr - Callback for each stderr line
   */
  run(
    topEntity: string,
    config: SimulationConfig,
    workDir: string,
    vhdlVersion?: VHDLVersion,
    onStderr?: (line: string) => void
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
