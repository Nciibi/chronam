// ============================================================================
// WaveForge — Testbench Generator Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { generateTestbench } from '../generator.js';
import type { Entity, SimulationConfig } from '@waveforge/shared-types';
import { createDefaultSimConfig } from '@waveforge/shared-types';

const counterEntity: Entity = {
  name: 'counter',
  ports: [
    { name: 'clk', direction: 'in', type: { kind: 'std_logic' } },
    { name: 'reset', direction: 'in', type: { kind: 'std_logic' } },
    { name: 'q', direction: 'out', type: { kind: 'std_logic_vector', range: { direction: 'downto', high: 3, low: 0 } } },
  ],
  generics: [],
  location: { file: 'counter.vhd', startLine: 1, endLine: 10, startColumn: 0, endColumn: 0 },
};

describe('Testbench Generator', () => {
  it('should generate valid VHDL testbench', () => {
    const config = createDefaultSimConfig();
    const result = generateTestbench(counterEntity, { config });

    expect(result.entityName).toBe('tb_counter');
    expect(result.source).toContain('entity tb_counter is');
    expect(result.source).toContain('end entity tb_counter;');
    expect(result.source).toContain('architecture sim of tb_counter is');
  });

  it('should auto-detect clock signals', () => {
    const config = createDefaultSimConfig();
    const result = generateTestbench(counterEntity, { config });

    expect(result.detectedClocks).toContain('clk');
    expect(result.source).toContain('clk_proc : process');
  });

  it('should auto-detect reset signals', () => {
    const config = createDefaultSimConfig();
    const result = generateTestbench(counterEntity, { config });

    expect(result.detectedResets).toContain('reset');
  });

  it('should instantiate DUT with port map', () => {
    const config = createDefaultSimConfig();
    const result = generateTestbench(counterEntity, { config });

    expect(result.source).toContain('uut : entity work.counter');
    expect(result.source).toContain('clk => clk');
    expect(result.source).toContain('reset => reset');
    expect(result.source).toContain('q => q');
  });

  it('should declare signals for all ports', () => {
    const config = createDefaultSimConfig();
    const result = generateTestbench(counterEntity, { config });

    expect(result.source).toContain('signal clk : std_logic');
    expect(result.source).toContain('signal reset : std_logic');
    expect(result.source).toContain('signal q : std_logic_vector(3 downto 0)');
  });

  it('should include simulation duration', () => {
    const config = createDefaultSimConfig();
    config.durationNs = 500;
    const result = generateTestbench(counterEntity, { config });

    expect(result.source).toContain('wait for 500 ns');
  });

  it('should include sim_done signal', () => {
    const config = createDefaultSimConfig();
    const result = generateTestbench(counterEntity, { config });

    expect(result.source).toContain('sim_done <= true');
  });
});
