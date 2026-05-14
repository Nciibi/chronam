// ============================================================================
// Chronam — Waveform Data Types
// ============================================================================
// Data model for parsed waveform files (VCD, GHW, FST).
// These types represent the in-memory model consumed by the renderer.
// ============================================================================

/** Time unit used in waveform files */
export type TimeUnit = 'fs' | 'ps' | 'ns' | 'us' | 'ms' | 's';

/**
 * A single signal value — either a scalar (1-bit) or vector (multi-bit).
 * Scalar values include all nine IEEE 1164 states.
 */
export type SignalValue =
  | { kind: 'scalar'; value: ScalarValue }
  | { kind: 'vector'; value: string; width: number };

/** IEEE 1164 nine-value logic */
export type ScalarValue = '0' | '1' | 'x' | 'z' | 'u' | '-' | 'w' | 'l' | 'h';

/** A single value transition at a specific simulation time */
export interface SignalTransition {
  /** Simulation time in base time units */
  time: number;
  /** New signal value at this time */
  value: SignalValue;
}

/** A complete signal trace with all its transitions */
export interface WaveformSignal {
  /** Unique signal identifier (from VCD, e.g., "!") */
  id: string;
  /** Short signal name (e.g., "clk") */
  name: string;
  /** Full hierarchical path (e.g., ["tb_counter", "uut", "clk"]) */
  hierarchyPath: string[];
  /** Bit width of the signal */
  width: number;
  /** Ordered list of value transitions */
  transitions: SignalTransition[];
}

/** Complete parsed waveform data from a VCD/GHW file */
export interface WaveformData {
  /** Timescale specification */
  timescale: TimescaleSpec;
  /** End time of the simulation */
  endTime: number;
  /** All signals in the waveform */
  signals: WaveformSignal[];
  /** File metadata */
  metadata: WaveformMetadata;
}

/** Timescale specification (e.g., 1ns) */
export interface TimescaleSpec {
  value: number;
  unit: TimeUnit;
}

/** Optional metadata from the waveform file */
export interface WaveformMetadata {
  date?: string;
  version?: string;
  comment?: string;
  generator?: string;
}

/** Viewport state for the waveform viewer — defines visible region */
export interface ViewportState {
  /** Start of visible time range */
  startTime: number;
  /** End of visible time range */
  endTime: number;
  /** Vertical scroll offset in pixels */
  scrollY: number;
  /** Zoom level (pixels per time unit) */
  pixelsPerTimeUnit: number;
}

/** Cursor state for timing measurements */
export interface CursorState {
  /** Primary cursor position (simulation time), null if not placed */
  primary: number | null;
  /** Secondary cursor for delta measurement, null if not placed */
  secondary: number | null;
}

/** Display format for multi-bit signals */
export type SignalDisplayFormat = 'hex' | 'binary' | 'decimal' | 'unsigned' | 'signed' | 'ascii';

/** Per-signal display configuration */
export interface SignalDisplayConfig {
  signalId: string;
  /** Display format for vector signals */
  format: SignalDisplayFormat;
  /** Signal color override */
  color?: string;
  /** Signal height in pixels */
  height?: number;
  /** Whether this signal is expanded (for buses) */
  expanded?: boolean;
  /** Whether this signal is visible */
  visible: boolean;
}

/** Signal group for organizing signals */
export interface SignalGroup {
  name: string;
  signalIds: string[];
  collapsed: boolean;
}

/**
 * Convert a time value from one unit to another.
 */
export function convertTimeUnit(value: number, from: TimeUnit, to: TimeUnit): number {
  const factors: Record<TimeUnit, number> = {
    fs: 1e-15,
    ps: 1e-12,
    ns: 1e-9,
    us: 1e-6,
    ms: 1e-3,
    s: 1,
  };
  return value * (factors[from] / factors[to]);
}

/**
 * Format a time value with appropriate unit for display.
 */
export function formatTime(timeValue: number, baseUnit: TimeUnit): string {
  const units: TimeUnit[] = ['fs', 'ps', 'ns', 'us', 'ms', 's'];
  const factors: Record<TimeUnit, number> = {
    fs: 1e-15,
    ps: 1e-12,
    ns: 1e-9,
    us: 1e-6,
    ms: 1e-3,
    s: 1,
  };

  const absSeconds = Math.abs(timeValue * factors[baseUnit]);

  // Find the best unit
  for (let i = units.length - 1; i >= 0; i--) {
    const unit = units[i];
    const converted = absSeconds / factors[unit];
    if (converted >= 1 || i === 0) {
      const sign = timeValue < 0 ? '-' : '';
      return `${sign}${converted.toFixed(converted < 10 ? 2 : 0)} ${unit}`;
    }
  }

  return `${timeValue} ${baseUnit}`;
}

/**
 * Format a signal value for display.
 */
export function formatSignalValue(value: SignalValue, format: SignalDisplayFormat = 'hex'): string {
  if (value.kind === 'scalar') {
    return value.value.toUpperCase();
  }

  const bits = value.value;

  // Check for non-binary values (X, Z, U, etc.)
  if (/[^01]/i.test(bits)) {
    return bits.toUpperCase();
  }

  switch (format) {
    case 'binary':
      return bits;
    case 'hex': {
      const num = parseInt(bits, 2);
      const hexDigits = Math.ceil(value.width / 4);
      return '0x' + num.toString(16).toUpperCase().padStart(hexDigits, '0');
    }
    case 'decimal':
    case 'unsigned':
      return parseInt(bits, 2).toString();
    case 'signed': {
      const num = parseInt(bits, 2);
      const signBit = 1 << (value.width - 1);
      return ((num ^ signBit) - signBit).toString();
    }
    case 'ascii': {
      let result = '';
      for (let i = 0; i < bits.length; i += 8) {
        const byte = parseInt(bits.substring(i, i + 8), 2);
        result += byte >= 32 && byte < 127 ? String.fromCharCode(byte) : '.';
      }
      return result;
    }
  }
}
