// ============================================================================
// Chronam — Webview Message Protocol
// ============================================================================
// Defines the strongly-typed message protocol between the VS Code extension
// host and the webview panels. All communication goes through postMessage.
// ============================================================================

import type { Entity } from './vhdl.js';
import type { SimulationConfig, SimulationStatus, SimulationError } from './simulation.js';
import type { WaveformData, WaveformSignal, ViewportState, CursorState, SignalDisplayConfig } from './waveform.js';

// ─── Extension Host → Webview Messages ─────────────────────────────────────

export type ExtensionToWebviewMessage =
  | WaveformLoadMessage
  | WaveformUpdateMessage
  | SimulationStatusMessage
  | SimulationConfigMessage
  | EntityDetectedMessage
  | ThemeChangedMessage
  | ErrorMessage;

export interface WaveformLoadMessage {
  type: 'waveform:load';
  data: WaveformData;
}

export interface WaveformUpdateMessage {
  type: 'waveform:update';
  signals: WaveformSignal[];
}

export interface SimulationStatusMessage {
  type: 'simulation:status';
  status: SimulationStatus;
}

export interface SimulationConfigMessage {
  type: 'simulation:config';
  config: SimulationConfig;
}

export interface EntityDetectedMessage {
  type: 'entity:detected';
  entities: Entity[];
}

export interface ThemeChangedMessage {
  type: 'theme:changed';
  theme: ThemeConfig;
}

export interface ErrorMessage {
  type: 'error';
  title: string;
  message: string;
  errors?: SimulationError[];
}

// ─── Webview → Extension Host Messages ─────────────────────────────────────

export type WebviewToExtensionMessage =
  | SimulationRunMessage
  | SimulationStopMessage
  | SimulationUpdateConfigMessage
  | WaveformExportMessage
  | WebviewReadyMessage
  | WebviewErrorMessage
  | ViewportChangedMessage
  | CursorChangedMessage
  | SignalConfigChangedMessage
  | AiQueryMessage;

export interface SimulationRunMessage {
  type: 'simulation:run';
  config: SimulationConfig;
}

export interface SimulationStopMessage {
  type: 'simulation:stop';
}

export interface SimulationUpdateConfigMessage {
  type: 'simulation:updateConfig';
  config: Partial<SimulationConfig>;
}

export interface WaveformExportMessage {
  type: 'waveform:export';
  format: 'png' | 'svg';
}

export interface WebviewReadyMessage {
  type: 'ready';
}

export interface WebviewErrorMessage {
  type: 'webview:error';
  message: string;
  stack?: string;
}

export interface ViewportChangedMessage {
  type: 'viewport:changed';
  viewport: ViewportState;
}

export interface CursorChangedMessage {
  type: 'cursor:changed';
  cursor: CursorState;
}

export interface SignalConfigChangedMessage {
  type: 'signal:configChanged';
  config: SignalDisplayConfig;
}

export interface AiQueryMessage {
  type: 'ai:query';
  text: string;
}

// ─── Theme Configuration ────────────────────────────────────────────────────

export interface ThemeConfig {
  kind: 'dark' | 'light';
  colors: {
    background: string;
    foreground: string;
    gridLine: string;
    cursorLine: string;
    signalHigh: string;
    signalLow: string;
    signalX: string;
    signalZ: string;
    signalU: string;
    vectorFill: string;
    vectorText: string;
    selectionBg: string;
    headerBg: string;
    divider: string;
  };
}

/** Default dark theme matching VS Code Dark+ */
export const DEFAULT_DARK_THEME: ThemeConfig = {
  kind: 'dark',
  colors: {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    gridLine: '#2a2a2a',
    cursorLine: '#ffcc00',
    signalHigh: '#4fc1ff',
    signalLow: '#4fc1ff',
    signalX: '#ff5555',
    signalZ: '#ffaa00',
    signalU: '#ff79c6',
    vectorFill: '#264f78',
    vectorText: '#d4d4d4',
    selectionBg: '#264f7844',
    headerBg: '#252526',
    divider: '#3c3c3c',
  },
};

/** Default light theme matching VS Code Light+ */
export const DEFAULT_LIGHT_THEME: ThemeConfig = {
  kind: 'light',
  colors: {
    background: '#ffffff',
    foreground: '#333333',
    gridLine: '#e8e8e8',
    cursorLine: '#ff8c00',
    signalHigh: '#0066cc',
    signalLow: '#0066cc',
    signalX: '#cc0000',
    signalZ: '#cc8800',
    signalU: '#cc0088',
    vectorFill: '#d6eaff',
    vectorText: '#333333',
    selectionBg: '#d6eaff88',
    headerBg: '#f3f3f3',
    divider: '#d4d4d4',
  },
};
