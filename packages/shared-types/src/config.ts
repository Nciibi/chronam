// ============================================================================
// WaveForge — Configuration Types
// ============================================================================

import type { SimulatorId, VHDLVersion } from './simulation.js';
import type { SignalDisplayFormat } from './waveform.js';

export interface WaveForgeConfig {
  simulator: SimulatorConfig;
  waveViewer: WaveViewerConfig;
  testbench: TestbenchConfig;
  general: GeneralConfig;
}

export interface SimulatorConfig {
  preferred: SimulatorId;
  ghdlPath: string;
  vhdlVersion: VHDLVersion;
  defaultDurationNs: number;
  extraFlags: string[];
}

export interface WaveViewerConfig {
  defaultFormat: SignalDisplayFormat;
  signalHeight: number;
  showGrid: boolean;
  showHierarchy: boolean;
  virtualizationThreshold: number;
}

export interface TestbenchConfig {
  defaultClockPeriodNs: number;
  defaultResetDurationNs: number;
  autoDetect: boolean;
  clockPatterns: string[];
  resetPatterns: string[];
}

export interface GeneralConfig {
  autoOpenWaveViewer: boolean;
  clearOnRerun: boolean;
  workDir: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export const DEFAULT_CONFIG: WaveForgeConfig = {
  simulator: {
    preferred: 'ghdl',
    ghdlPath: '',
    vhdlVersion: '2008',
    defaultDurationNs: 1000,
    extraFlags: [],
  },
  waveViewer: {
    defaultFormat: 'hex',
    signalHeight: 30,
    showGrid: true,
    showHierarchy: true,
    virtualizationThreshold: 200,
  },
  testbench: {
    defaultClockPeriodNs: 10,
    defaultResetDurationNs: 20,
    autoDetect: true,
    clockPatterns: ['clk', 'clock', 'clk_*', '*_clk'],
    resetPatterns: ['rst', 'reset', 'rst_n', 'reset_n', 'rstn'],
  },
  general: {
    autoOpenWaveViewer: true,
    clearOnRerun: true,
    workDir: '.waveforge',
    logLevel: 'info',
  },
};
