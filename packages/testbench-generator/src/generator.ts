// ============================================================================
// WaveForge — Testbench Generator
// ============================================================================
// Generates synthesizable VHDL testbenches from parsed entity information
// and simulation configuration. Produces complete, runnable testbenches
// with clock processes, reset sequences, and stimulus.
// ============================================================================

import type {
  Entity,
  Port,
  VHDLType,
  ClockConfig,
  SimulationConfig,
} from '@waveforge/shared-types';
import { getDefaultValue } from '@waveforge/shared-types';

/** Options controlling testbench generation */
export interface TestbenchOptions {
  /** Simulation configuration */
  config: SimulationConfig;
  /** Clock signal patterns for auto-detection */
  clockPatterns?: string[];
  /** Reset signal patterns for auto-detection */
  resetPatterns?: string[];
  /** Default reset duration in ns */
  resetDurationNs?: number;
}

/** Result of testbench generation */
export interface TestbenchResult {
  /** Generated VHDL testbench source code */
  source: string;
  /** Name of the testbench entity */
  entityName: string;
  /** Detected clock signals */
  detectedClocks: string[];
  /** Detected reset signals */
  detectedResets: string[];
}

const DEFAULT_CLOCK_PATTERNS = ['clk', 'clock', 'clk_i', 'i_clk', 'sys_clk'];
const DEFAULT_RESET_PATTERNS = ['rst', 'reset', 'rst_n', 'reset_n', 'rstn', 'rst_i', 'i_rst'];

/**
 * Generate a complete VHDL testbench for the given entity.
 */
export function generateTestbench(entity: Entity, options: TestbenchOptions): TestbenchResult {
  const clockPatterns = options.clockPatterns ?? DEFAULT_CLOCK_PATTERNS;
  const resetPatterns = options.resetPatterns ?? DEFAULT_RESET_PATTERNS;
  const resetDurationNs = options.resetDurationNs ?? 20;

  const tbName = `tb_${entity.name}`;
  const detectedClocks = detectClockSignals(entity.ports, clockPatterns);
  const detectedResets = detectResetSignals(entity.ports, resetPatterns);

  // Build clock configs from detected clocks + user config
  const clockConfigs = buildClockConfigs(detectedClocks, options.config.clocks);

  const lines: string[] = [];

  // Library declarations
  lines.push('-- Auto-generated testbench by WaveForge');
  lines.push(`-- Entity: ${entity.name}`);
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('library ieee;');
  lines.push('use ieee.std_logic_1164.all;');
  lines.push('use ieee.numeric_std.all;');
  lines.push('');

  // Entity declaration (empty for testbench)
  lines.push(`entity ${tbName} is`);
  lines.push(`end entity ${tbName};`);
  lines.push('');

  // Architecture
  lines.push(`architecture sim of ${tbName} is`);
  lines.push('');

  // Signal declarations for all DUT ports
  for (const port of entity.ports) {
    const typeStr = vhdlTypeToString(port.type);
    const defaultVal = getDefaultValue(port.type);
    lines.push(`    signal ${port.name} : ${typeStr} := ${defaultVal};`);
  }

  lines.push('');

  // Constants
  for (const cc of clockConfigs) {
    const halfPeriod = cc.periodNs / 2;
    lines.push(`    constant ${cc.signalName.toUpperCase()}_PERIOD : time := ${cc.periodNs} ns;`);
    lines.push(`    constant ${cc.signalName.toUpperCase()}_HALF   : time := ${halfPeriod} ns;`);
  }

  if (clockConfigs.length > 0) {
    lines.push('');
  }

  // Simulation control
  lines.push('    signal sim_done : boolean := false;');
  lines.push('');
  lines.push('begin');
  lines.push('');

  // DUT instantiation
  lines.push(`    -- Device Under Test`);
  lines.push(`    uut : entity work.${entity.name}`);

  if (entity.ports.length > 0) {
    lines.push('        port map (');
    const portMaps = entity.ports.map((p, i) => {
      const comma = i < entity.ports.length - 1 ? ',' : '';
      return `            ${p.name} => ${p.name}${comma}`;
    });
    lines.push(...portMaps);
    lines.push('        );');
  } else {
    lines.push('        ;');
  }

  lines.push('');

  // Clock processes
  for (const cc of clockConfigs) {
    lines.push(`    -- Clock process: ${cc.signalName}`);
    lines.push(`    ${cc.signalName}_proc : process`);
    lines.push('    begin');
    lines.push('        while not sim_done loop');
    lines.push(`            ${cc.signalName} <= '${cc.initialValue}';`);
    lines.push(`            wait for ${cc.signalName.toUpperCase()}_HALF;`);
    const toggleValue = cc.initialValue === '0' ? '1' : '0';
    lines.push(`            ${cc.signalName} <= '${toggleValue}';`);
    lines.push(`            wait for ${cc.signalName.toUpperCase()}_HALF;`);
    lines.push('        end loop;');
    lines.push('        wait;');
    lines.push('    end process;');
    lines.push('');
  }

  // Stimulus process
  lines.push('    -- Stimulus process');
  lines.push('    stim_proc : process');
  lines.push('    begin');

  // Reset sequence
  if (detectedResets.length > 0) {
    lines.push('        -- Reset sequence');
    for (const rst of detectedResets) {
      const isActiveHigh = !rst.toLowerCase().includes('_n') && !rst.toLowerCase().endsWith('n');
      const assertValue = isActiveHigh ? "'1'" : "'0'";
      const deassertValue = isActiveHigh ? "'0'" : "'1'";

      lines.push(`        ${rst} <= ${assertValue};`);
      lines.push(`        wait for ${resetDurationNs} ns;`);
      lines.push(`        ${rst} <= ${deassertValue};`);
    }
    lines.push('');
  }

  // User-defined stimulus events
  const userStimuli = options.config.stimuli.filter(
    (s) => !detectedClocks.includes(s.signalName) && !detectedResets.includes(s.signalName)
  );

  if (userStimuli.length > 0) {
    lines.push('        -- User stimulus');
    for (const stim of userStimuli) {
      for (const event of stim.events) {
        lines.push(`        wait for ${event.timeNs} ns;`);
        lines.push(`        ${stim.signalName} <= ${event.value};`);
      }
    }
    lines.push('');
  }

  // Default wait and end
  lines.push(`        -- Run simulation for ${options.config.durationNs} ns`);
  lines.push(`        wait for ${options.config.durationNs} ns;`);
  lines.push('');
  lines.push('        -- End simulation');
  lines.push('        sim_done <= true;');
  lines.push('        wait;');
  lines.push('    end process;');
  lines.push('');
  lines.push(`end architecture sim;`);
  lines.push('');

  return {
    source: lines.join('\n'),
    entityName: tbName,
    detectedClocks,
    detectedResets,
  };
}

// ─── Signal Detection ───────────────────────────────────────────────────────

function detectClockSignals(ports: Port[], patterns: string[]): string[] {
  return ports
    .filter((p) => {
      if (p.direction !== 'in') return false;
      if (p.type.kind !== 'std_logic' && p.type.kind !== 'bit') return false;
      return matchesPatterns(p.name, patterns);
    })
    .map((p) => p.name);
}

function detectResetSignals(ports: Port[], patterns: string[]): string[] {
  return ports
    .filter((p) => {
      if (p.direction !== 'in') return false;
      if (p.type.kind !== 'std_logic' && p.type.kind !== 'bit') return false;
      return matchesPatterns(p.name, patterns);
    })
    .map((p) => p.name);
}

function matchesPatterns(name: string, patterns: string[]): boolean {
  const lower = name.toLowerCase();
  return patterns.some((pattern) => {
    const p = pattern.toLowerCase();
    if (p.includes('*')) {
      const regex = new RegExp('^' + p.replace(/\*/g, '.*') + '$');
      return regex.test(lower);
    }
    return lower === p;
  });
}

function buildClockConfigs(detected: string[], userConfigs: ClockConfig[]): ClockConfig[] {
  const configs: ClockConfig[] = [];
  const userConfigMap = new Map(userConfigs.map((c) => [c.signalName, c]));

  for (const name of detected) {
    const userCfg = userConfigMap.get(name);
    configs.push(
      userCfg ?? {
        signalName: name,
        periodNs: 10,
        dutyCycle: 0.5,
        initialValue: '0',
      }
    );
  }

  return configs;
}

// ─── VHDL Type to String ────────────────────────────────────────────────────

export function vhdlTypeToString(type: VHDLType): string {
  switch (type.kind) {
    case 'std_logic':
      return 'std_logic';
    case 'std_logic_vector':
      return `std_logic_vector(${type.range.high} ${type.range.direction} ${type.range.low})`;
    case 'integer':
      if (type.range) return `integer range ${type.range.low} to ${type.range.high}`;
      return 'integer';
    case 'unsigned':
      return `unsigned(${type.range.high} ${type.range.direction} ${type.range.low})`;
    case 'signed':
      return `signed(${type.range.high} ${type.range.direction} ${type.range.low})`;
    case 'boolean':
      return 'boolean';
    case 'bit':
      return 'bit';
    case 'bit_vector':
      return `bit_vector(${type.range.high} ${type.range.direction} ${type.range.low})`;
    case 'natural':
      return 'natural';
    case 'positive':
      return 'positive';
    case 'custom':
      return type.name;
  }
}
