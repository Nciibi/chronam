// ============================================================================
// WaveForge — VHDL Domain Types
// ============================================================================
// Core type definitions for representing parsed VHDL design units.
// These types model the essential structural information extracted from VHDL
// source files: entities, ports, architectures, signals, and processes.
// ============================================================================

/** Direction of a VHDL port signal */
export type PortDirection = 'in' | 'out' | 'inout' | 'buffer';

/** Range specification for vector types */
export interface VectorRange {
  direction: 'downto' | 'to';
  high: number;
  low: number;
}

/**
 * Discriminated union representing VHDL data types.
 * Extensible to support more types as parsing capabilities grow.
 */
export type VHDLType =
  | { kind: 'std_logic' }
  | { kind: 'std_logic_vector'; range: VectorRange }
  | { kind: 'integer'; range?: { low: number; high: number } }
  | { kind: 'unsigned'; range: VectorRange }
  | { kind: 'signed'; range: VectorRange }
  | { kind: 'boolean' }
  | { kind: 'bit' }
  | { kind: 'bit_vector'; range: VectorRange }
  | { kind: 'natural' }
  | { kind: 'positive' }
  | { kind: 'custom'; name: string };

/** A port declaration within an entity */
export interface Port {
  name: string;
  direction: PortDirection;
  type: VHDLType;
}

/** A generic parameter declaration within an entity */
export interface Generic {
  name: string;
  type: VHDLType;
  defaultValue?: string;
}

/** A complete entity declaration */
export interface Entity {
  name: string;
  ports: Port[];
  generics: Generic[];
  location: SourceLocation;
}

/** An architecture body associated with an entity */
export interface Architecture {
  name: string;
  entityName: string;
  signals: InternalSignal[];
  processes: ProcessInfo[];
  location: SourceLocation;
}

/** An internal signal declared within an architecture */
export interface InternalSignal {
  name: string;
  type: VHDLType;
  defaultValue?: string;
}

/** Extracted process information */
export interface ProcessInfo {
  label?: string;
  sensitivityList: string[];
  location: SourceLocation;
}

/** Source code location reference */
export interface SourceLocation {
  file: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
}

/** A parsed VHDL file with all extracted design units */
export interface VHDLFile {
  uri: string;
  entities: Entity[];
  architectures: Architecture[];
  errors: ParseDiagnostic[];
}

/** A diagnostic message from the parser */
export interface ParseDiagnostic {
  message: string;
  location: SourceLocation;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Compute the bit width of a VHDL type.
 * Returns 1 for scalar types, range width for vector types, 32 for integers.
 */
export function getTypeWidth(type: VHDLType): number {
  switch (type.kind) {
    case 'std_logic':
    case 'bit':
    case 'boolean':
      return 1;
    case 'std_logic_vector':
    case 'bit_vector':
    case 'unsigned':
    case 'signed':
      return Math.abs(type.range.high - type.range.low) + 1;
    case 'integer':
    case 'natural':
    case 'positive':
      return 32;
    case 'custom':
      return 1; // Default, unknown width
  }
}

/**
 * Get the default initial value for a VHDL type.
 * Used by the testbench generator for initializing signals.
 */
export function getDefaultValue(type: VHDLType): string {
  switch (type.kind) {
    case 'std_logic':
      return "'0'";
    case 'bit':
      return "'0'";
    case 'boolean':
      return 'false';
    case 'std_logic_vector':
    case 'unsigned':
    case 'signed': {
      const width = Math.abs(type.range.high - type.range.low) + 1;
      return `(others => '0')`;
    }
    case 'bit_vector': {
      return `(others => '0')`;
    }
    case 'integer':
    case 'natural':
    case 'positive':
      return '0';
    case 'custom':
      return "'0'"; // Best guess
  }
}
