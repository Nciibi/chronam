// ============================================================================
// WaveForge — VHDL Parser Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { parseVHDLFile, parseVHDLType } from '../parser.js';

const COUNTER_VHDL = `
library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity counter is
  port(
    clk   : in  std_logic;
    reset : in  std_logic;
    q     : out std_logic_vector(3 downto 0)
  );
end entity counter;

architecture rtl of counter is
  signal count : unsigned(3 downto 0) := (others => '0');
begin
  process(clk, reset)
  begin
    if reset = '1' then
      count <= (others => '0');
    elsif rising_edge(clk) then
      count <= count + 1;
    end if;
  end process;

  q <= std_logic_vector(count);
end architecture rtl;
`;

describe('VHDL Parser', () => {
  describe('Entity Extraction', () => {
    it('should extract entity name', () => {
      const result = parseVHDLFile(COUNTER_VHDL, 'counter.vhd');
      expect(result.entities.length).toBe(1);
      expect(result.entities[0].name).toBe('counter');
    });

    it('should extract all ports', () => {
      const result = parseVHDLFile(COUNTER_VHDL, 'counter.vhd');
      const entity = result.entities[0];
      expect(entity.ports.length).toBe(3);
    });

    it('should parse port directions', () => {
      const result = parseVHDLFile(COUNTER_VHDL, 'counter.vhd');
      const ports = result.entities[0].ports;
      expect(ports.find(p => p.name === 'clk')?.direction).toBe('in');
      expect(ports.find(p => p.name === 'q')?.direction).toBe('out');
    });

    it('should parse std_logic type', () => {
      const result = parseVHDLFile(COUNTER_VHDL, 'counter.vhd');
      const clk = result.entities[0].ports.find(p => p.name === 'clk');
      expect(clk?.type).toEqual({ kind: 'std_logic' });
    });

    it('should parse std_logic_vector with range', () => {
      const result = parseVHDLFile(COUNTER_VHDL, 'counter.vhd');
      const q = result.entities[0].ports.find(p => p.name === 'q');
      expect(q?.type).toEqual({
        kind: 'std_logic_vector',
        range: { direction: 'downto', high: 3, low: 0 },
      });
    });
  });

  describe('Architecture Extraction', () => {
    it('should extract architecture', () => {
      const result = parseVHDLFile(COUNTER_VHDL, 'counter.vhd');
      expect(result.architectures.length).toBe(1);
      expect(result.architectures[0].name).toBe('rtl');
      expect(result.architectures[0].entityName).toBe('counter');
    });

    it('should extract internal signals', () => {
      const result = parseVHDLFile(COUNTER_VHDL, 'counter.vhd');
      const arch = result.architectures[0];
      expect(arch.signals.length).toBe(1);
      expect(arch.signals[0].name).toBe('count');
    });
  });

  describe('Type Parser', () => {
    it('should parse std_logic', () => {
      expect(parseVHDLType('std_logic')).toEqual({ kind: 'std_logic' });
    });

    it('should parse std_logic_vector', () => {
      expect(parseVHDLType('std_logic_vector(7 downto 0)')).toEqual({
        kind: 'std_logic_vector',
        range: { direction: 'downto', high: 7, low: 0 },
      });
    });

    it('should parse integer', () => {
      expect(parseVHDLType('integer')).toEqual({ kind: 'integer' });
    });

    it('should parse boolean', () => {
      expect(parseVHDLType('boolean')).toEqual({ kind: 'boolean' });
    });

    it('should parse unsigned', () => {
      expect(parseVHDLType('unsigned(15 downto 0)')).toEqual({
        kind: 'unsigned',
        range: { direction: 'downto', high: 15, low: 0 },
      });
    });

    it('should handle custom types', () => {
      const result = parseVHDLType('my_custom_type');
      expect(result).toEqual({ kind: 'custom', name: 'my_custom_type' });
    });
  });

  describe('Multi-entity files', () => {
    it('should extract multiple entities', () => {
      const src = `
entity foo is port(a : in std_logic); end entity foo;
entity bar is port(b : out std_logic); end entity bar;
      `;
      const result = parseVHDLFile(src, 'test.vhd');
      expect(result.entities.length).toBe(2);
      expect(result.entities[0].name).toBe('foo');
      expect(result.entities[1].name).toBe('bar');
    });
  });
});
