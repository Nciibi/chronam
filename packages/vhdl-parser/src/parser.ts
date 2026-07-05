// ============================================================================
// Chronam — VHDL Entity/Port Parser
// ============================================================================
// Regex-based VHDL parser for extracting entities, ports, generics, and
// architectures. This is the initial implementation — will be replaced by
// tree-sitter-vhdl for full AST support in Phase 2.
//
// Design decision: Regex is sufficient for Phase 1 entity/port extraction.
// tree-sitter would add WASM dependency complexity. We isolate parsing
// behind a clean interface so the implementation is swappable.
// ============================================================================

import type {
  Entity,
  Port,
  Generic,
  Architecture,
  InternalSignal,
  VHDLFile,
  VHDLType,
  VectorRange,
  PortDirection,
  SourceLocation,
  ParseDiagnostic,
} from '@chronam/shared-types';

/**
 * Parse a VHDL file and extract all design units.
 *
 * @param content - VHDL source code string
 * @param uri - File URI for error reporting
 * @returns Parsed file with entities, architectures, and diagnostics
 */
export function parseVHDLFile(content: string, uri: string): VHDLFile {
  const errors: ParseDiagnostic[] = [];

  const entities = extractEntities(content, uri, errors);
  const architectures = extractArchitectures(content, uri, errors);

  return { uri, entities, architectures, errors };
}

/**
 * Extract a single entity from VHDL source (convenience for single-entity files).
 */
export function extractFirstEntity(content: string, uri: string = ''): Entity | null {
  const file = parseVHDLFile(content, uri);
  return file.entities[0] ?? null;
}

// ─── Entity Extraction ─────────────────────────────────────────────────────

function extractEntities(content: string, uri: string, errors: ParseDiagnostic[]): Entity[] {
  const entities: Entity[] = [];

  // Match entity declarations — case insensitive, multiline
  // Pattern: entity <name> is ... end [entity] [<name>];
  const entityRegex = /entity\s+(\w+)\s+is\s*([\s\S]*?)end\s+(?:entity\s+)?(?:\1\s*)?;/gi;

  let match;
  while ((match = entityRegex.exec(content)) !== null) {
    const name = match[1];
    const body = match[2];
    const startLine = getLineNumber(content, match.index);
    const endLine = getLineNumber(content, match.index + match[0].length);

    const ports = extractPorts(body, uri, errors);
    const generics = extractGenerics(body, uri, errors);

    entities.push({
      name,
      ports,
      generics,
      location: {
        file: uri,
        startLine,
        endLine,
        startColumn: 0,
        endColumn: 0,
      },
    });
  }

  return entities;
}

// ─── Port Extraction ────────────────────────────────────────────────────────

function extractPorts(entityBody: string, uri: string, errors: ParseDiagnostic[]): Port[] {
  const ports: Port[] = [];

  // Find port(...) section — must handle balanced parentheses inside types
  // like std_logic_vector(7 downto 0) which contain nested parens.
  const portStart = entityBody.match(/port\s*\(/i);
  if (!portStart) return ports;

  const openIdx = portStart.index! + portStart[0].length - 1; // index of '('
  const closeIdx = findBalancedClose(entityBody, openIdx);
  if (closeIdx === -1) return ports;

  const portSection = entityBody.slice(openIdx + 1, closeIdx);

  // Split by semicolons to get individual port declarations
  const portDeclarations = portSection.split(';').filter((s) => s.trim().length > 0);

  for (const decl of portDeclarations) {
    const trimmed = decl.trim();
    if (!trimmed) continue;

    // Remove inline comments
    const cleaned = trimmed.replace(/--.*$/gm, '').trim();
    if (!cleaned) continue;

    // Pattern: <names> : <direction> <type>
    const portMatch = cleaned.match(
      /^([\w\s,]+)\s*:\s*(in|out|inout|buffer)\s+(.+)$/i
    );

    if (!portMatch) {
      errors.push({
        message: `Could not parse port declaration: "${trimmed}"`,
        location: { file: uri, startLine: 0, endLine: 0, startColumn: 0, endColumn: 0 },
        severity: 'warning',
      });
      continue;
    }

    const names = portMatch[1].split(',').map((n) => n.trim()).filter(Boolean);
    const direction = portMatch[2].toLowerCase() as PortDirection;
    const typeStr = portMatch[3].trim();

    const type = parseVHDLType(typeStr);

    for (const name of names) {
      ports.push({ name, direction, type });
    }
  }

  return ports;
}

// ─── Generic Extraction ─────────────────────────────────────────────────────

function extractGenerics(entityBody: string, _uri: string, _errors: ParseDiagnostic[]): Generic[] {
  const generics: Generic[] = [];

  const genericStart = entityBody.match(/generic\s*\(/i);
  if (!genericStart) return generics;

  const openIdx = genericStart.index! + genericStart[0].length - 1;
  const closeIdx = findBalancedClose(entityBody, openIdx);
  if (closeIdx === -1) return generics;

  const genericSection = entityBody.slice(openIdx + 1, closeIdx);
  const genericDeclarations = genericSection.split(';').filter((s) => s.trim().length > 0);

  for (const decl of genericDeclarations) {
    const cleaned = decl.replace(/--.*$/gm, '').trim();
    if (!cleaned) continue;

    // Pattern: <name> : <type> [:= <default>]
    const match = cleaned.match(/^(\w+)\s*:\s*(\w+)(?:\s*:=\s*(.+))?$/i);
    if (!match) continue;

    generics.push({
      name: match[1],
      type: parseVHDLType(match[2]),
      defaultValue: match[3]?.trim(),
    });
  }

  return generics;
}

// ─── Architecture Extraction ────────────────────────────────────────────────

function extractArchitectures(content: string, uri: string, _errors: ParseDiagnostic[]): Architecture[] {
  const architectures: Architecture[] = [];

  const archRegex = /architecture\s+(\w+)\s+of\s+(\w+)\s+is\s*([\s\S]*?)begin\s*([\s\S]*?)end\s+(?:architecture\s+)?(?:\1\s*)?;/gi;

  let match;
  while ((match = archRegex.exec(content)) !== null) {
    const name = match[1];
    const entityName = match[2];
    const declarativeRegion = match[3];
    const bodyRegion = match[4];
    const startLine = getLineNumber(content, match.index);
    const endLine = getLineNumber(content, match.index + match[0].length);

    const signals = extractInternalSignals(declarativeRegion);
    const processes = extractProcessLabels(bodyRegion, uri);

    architectures.push({
      name,
      entityName,
      signals,
      processes,
      location: {
        file: uri,
        startLine,
        endLine,
        startColumn: 0,
        endColumn: 0,
      },
    });
  }

  return architectures;
}

function extractInternalSignals(declarativeRegion: string): InternalSignal[] {
  const signals: InternalSignal[] = [];

  const signalRegex = /signal\s+([\w\s,]+)\s*:\s*([^;]+);/gi;

  let match;
  while ((match = signalRegex.exec(declarativeRegion)) !== null) {
    const names = match[1].split(',').map((n) => n.trim()).filter(Boolean);
    const typeAndDefault = match[2].trim();

    // Split type from default value
    const defMatch = typeAndDefault.match(/^(.+?)\s*:=\s*(.+)$/);
    const typeStr = defMatch ? defMatch[1].trim() : typeAndDefault;
    const defaultValue = defMatch ? defMatch[2].trim() : undefined;

    const type = parseVHDLType(typeStr);

    for (const name of names) {
      signals.push({ name, type, defaultValue });
    }
  }

  return signals;
}

function extractProcessLabels(
  bodyRegion: string,
  uri: string
): Array<{ label?: string; sensitivityList: string[]; location: SourceLocation }> {
  const processes: Array<{ label?: string; sensitivityList: string[]; location: SourceLocation }> = [];

  // Match: [label :] process [(sensitivity_list)]
  const processRegex = /(?:(\w+)\s*:\s*)?process\s*(?:\(([\w\s,]*)\))?/gi;

  let match;
  while ((match = processRegex.exec(bodyRegion)) !== null) {
    const label = match[1] || undefined;
    const sensListStr = match[2] || '';
    const sensitivityList = sensListStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    processes.push({
      label,
      sensitivityList,
      location: {
        file: uri,
        startLine: getLineNumber(bodyRegion, match.index),
        endLine: getLineNumber(bodyRegion, match.index),
        startColumn: 0,
        endColumn: 0,
      },
    });
  }

  return processes;
}

// ─── Type Parser ────────────────────────────────────────────────────────────

/**
 * Parse a VHDL type string into a structured VHDLType.
 * Handles: std_logic, std_logic_vector(N downto M), integer, boolean, etc.
 */
export function parseVHDLType(typeStr: string): VHDLType {
  const normalized = typeStr.trim().toLowerCase();

  if (normalized === 'std_logic' || normalized === 'std_ulogic') {
    return { kind: 'std_logic' };
  }

  if (normalized === 'bit') {
    return { kind: 'bit' };
  }

  if (normalized === 'boolean') {
    return { kind: 'boolean' };
  }

  if (normalized === 'integer') {
    return { kind: 'integer' };
  }

  if (normalized === 'natural') {
    return { kind: 'natural' };
  }

  if (normalized === 'positive') {
    return { kind: 'positive' };
  }

  // std_logic_vector(N downto M) or std_logic_vector(M to N)
  const vectorMatch = typeStr.match(
    /std_logic_vector\s*\(\s*(\d+)\s+(downto|to)\s+(\d+)\s*\)/i
  );
  if (vectorMatch) {
    return {
      kind: 'std_logic_vector',
      range: parseRange(vectorMatch),
    };
  }

  // unsigned(N downto M)
  const unsignedMatch = typeStr.match(/unsigned\s*\(\s*(\d+)\s+(downto|to)\s+(\d+)\s*\)/i);
  if (unsignedMatch) {
    return {
      kind: 'unsigned',
      range: parseRange(unsignedMatch),
    };
  }

  // signed(N downto M)
  const signedMatch = typeStr.match(/signed\s*\(\s*(\d+)\s+(downto|to)\s+(\d+)\s*\)/i);
  if (signedMatch) {
    return {
      kind: 'signed',
      range: parseRange(signedMatch),
    };
  }

  // bit_vector(N downto M)
  const bitVecMatch = typeStr.match(/bit_vector\s*\(\s*(\d+)\s+(downto|to)\s+(\d+)\s*\)/i);
  if (bitVecMatch) {
    return {
      kind: 'bit_vector',
      range: parseRange(bitVecMatch),
    };
  }

  // integer range N to M
  const intRangeMatch = typeStr.match(/integer\s+range\s+(\d+)\s+to\s+(\d+)/i);
  if (intRangeMatch) {
    return {
      kind: 'integer',
      range: {
        low: parseInt(intRangeMatch[1], 10),
        high: parseInt(intRangeMatch[2], 10),
      },
    };
  }

  // Unknown type — treat as custom
  return { kind: 'custom', name: typeStr.trim() };
}

function parseRange(match: RegExpMatchArray): VectorRange {
  const a = parseInt(match[1], 10);
  const dir = match[2].toLowerCase() as 'downto' | 'to';
  const b = parseInt(match[3], 10);

  return {
    direction: dir,
    high: Math.max(a, b),
    low: Math.min(a, b),
  };
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/** Find the index of the matching close paren for the open paren at openIdx */
function findBalancedClose(text: string, openIdx: number): number {
  let depth = 1;
  for (let i = openIdx + 1; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function getLineNumber(content: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === '\n') line++;
  }
  return line;
}
