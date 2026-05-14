// ============================================================================
// WaveForge — Simulation Types
// ============================================================================
// Type definitions for simulation configuration, execution, and results.
// Designed to be simulator-agnostic with adapter-specific extensions.
// ============================================================================

import type { VHDLType, SourceLocation } from './vhdl.js';

/** Configuration for a single clock signal in the testbench */
export interface ClockConfig {
  /** Name of the clock port */
  signalName: string;
  /** Clock period in nanoseconds */
  periodNs: number;
  /** Duty cycle (0-1), defaults to 0.5 */
  dutyCycle: number;
  /** Initial value of the clock */
  initialValue: '0' | '1';
}

/** A single stimulus event: set a signal to a value at a specific time */
export interface StimulusEvent {
  /** Time in nanoseconds from simulation start */
  timeNs: number;
  /** Value to assign (VHDL literal) */
  value: string;
}

/** Configuration for stimulus applied to a single input signal */
export interface StimulusConfig {
  /** Name of the input port */
  signalName: string;
  /** VHDL type of the signal */
  type: VHDLType;
  /** Ordered list of value-change events */
  events: StimulusEvent[];
}

/** Complete simulation run configuration */
export interface SimulationConfig {
  /** Simulation duration in nanoseconds */
  durationNs: number;
  /** Clock configurations (auto-detected or user-specified) */
  clocks: ClockConfig[];
  /** Input signal stimulus */
  stimuli: StimulusConfig[];
  /** Output waveform format */
  waveFormat: 'vcd' | 'ghw';
  /** Simulator identifier */
  simulator: SimulatorId;
  /** Additional CLI flags for the simulator */
  extraFlags: string[];
}

/** Supported simulator identifiers */
export type SimulatorId = 'ghdl' | 'modelsim' | 'verilator';

/** Information about a detected simulator installation */
export interface SimulatorInfo {
  id: SimulatorId;
  name: string;
  version: string;
  path: string;
  capabilities: SimulatorCapabilities;
}

/** What a simulator supports */
export interface SimulatorCapabilities {
  vhdlVersions: VHDLVersion[];
  waveFormats: ('vcd' | 'ghw' | 'fst')[];
  supportsVerilog: boolean;
}

export type VHDLVersion = '1987' | '1993' | '2002' | '2008' | '2019';

/**
 * Simulation execution status — discriminated union for state machine.
 * UI can switch on `state` to render appropriate status indicators.
 */
export type SimulationStatus =
  | { state: 'idle' }
  | { state: 'preparing'; message: string }
  | { state: 'compiling'; file: string; step: number; totalSteps: number }
  | { state: 'elaborating'; entity: string }
  | { state: 'running'; progress?: number }
  | { state: 'completed'; durationMs: number; signalCount: number }
  | { state: 'failed'; errors: SimulationError[] }
  | { state: 'cancelled' };

/** A single simulation error with translated human-readable message */
export interface SimulationError {
  /** Which phase the error occurred in */
  phase: 'analysis' | 'elaboration' | 'runtime';
  /** Raw error string from simulator */
  raw: string;
  /** Human-readable translated error message */
  translated: string;
  /** Source location if available */
  location?: SourceLocation;
  /** Error severity */
  severity: 'error' | 'warning';
  /** Optional fix suggestion */
  suggestion?: string;
}

/** Result of a completed (or failed) simulation run */
export interface SimulationResult {
  /** Final status */
  status: SimulationStatus;
  /** Path to generated waveform file (if successful) */
  waveformPath?: string;
  /** All errors/warnings collected */
  errors: SimulationError[];
  /** Raw stdout from simulator */
  stdout: string;
  /** Raw stderr from simulator */
  stderr: string;
  /** Simulation duration wall time in ms */
  wallTimeMs: number;
}

/** Result of a compile/analyze step */
export interface CompileResult {
  success: boolean;
  errors: SimulationError[];
  stdout: string;
  stderr: string;
}

/** Default simulation configuration factory */
export function createDefaultSimConfig(): SimulationConfig {
  return {
    durationNs: 1000,
    clocks: [],
    stimuli: [],
    waveFormat: 'vcd',
    simulator: 'ghdl',
    extraFlags: [],
  };
}

/** Create a default clock config */
export function createDefaultClock(signalName: string): ClockConfig {
  return {
    signalName,
    periodNs: 10,
    dutyCycle: 0.5,
    initialValue: '0',
  };
}
