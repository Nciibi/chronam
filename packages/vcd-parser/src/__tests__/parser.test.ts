// ============================================================================
// Chronam — VCD Parser Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { parseVCD } from '../parser.js';

const SAMPLE_VCD = `$date
   Mon Jan 01 00:00:00 2024
$end
$version
   GHDL 4.0.0
$end
$timescale
   1 ns
$end
$scope module tb_counter $end
$var wire 1 ! clk $end
$var wire 1 " reset $end
$scope module uut $end
$var wire 4 # q [3:0] $end
$upscope $end
$upscope $end
$enddefinitions $end
$dumpvars
0!
1"
b0000 #
$end
#0
0!
1"
b0000 #
#5
1!
#10
0!
0"
#15
1!
b0001 #
#20
0!
#25
1!
b0010 #
#30
0!
#35
1!
b0011 #
#40
0!
#45
1!
b0100 #
#50
`;

describe('VCD Parser', () => {
  it('should parse timescale', () => {
    const data = parseVCD(SAMPLE_VCD);
    expect(data.timescale.value).toBe(1);
    expect(data.timescale.unit).toBe('ns');
  });

  it('should parse metadata', () => {
    const data = parseVCD(SAMPLE_VCD);
    expect(data.metadata.version).toContain('GHDL');
  });

  it('should parse all signals', () => {
    const data = parseVCD(SAMPLE_VCD);
    expect(data.signals.length).toBe(3);

    const clk = data.signals.find(s => s.name === 'clk');
    expect(clk).toBeDefined();
    expect(clk!.width).toBe(1);

    const q = data.signals.find(s => s.name === 'q');
    expect(q).toBeDefined();
    expect(q!.width).toBe(4);
  });

  it('should parse signal hierarchy', () => {
    const data = parseVCD(SAMPLE_VCD);
    const q = data.signals.find(s => s.name === 'q');
    expect(q!.hierarchyPath).toEqual(['tb_counter', 'uut', 'q']);
  });

  it('should parse scalar transitions', () => {
    const data = parseVCD(SAMPLE_VCD);
    const clk = data.signals.find(s => s.name === 'clk');
    expect(clk!.transitions.length).toBeGreaterThan(0);

    // Check first transition
    const first = clk!.transitions[0];
    expect(first.time).toBe(0);
    expect(first.value).toEqual({ kind: 'scalar', value: '0' });
  });

  it('should parse vector transitions', () => {
    const data = parseVCD(SAMPLE_VCD);
    const q = data.signals.find(s => s.name === 'q');

    // Find transition to 0010 (value 2)
    const t2 = q!.transitions.find(t =>
      t.value.kind === 'vector' && t.value.value === '0010'
    );
    expect(t2).toBeDefined();
    expect(t2!.time).toBe(25);
  });

  it('should track end time correctly', () => {
    const data = parseVCD(SAMPLE_VCD);
    expect(data.endTime).toBe(50);
  });

  it('should handle empty VCD gracefully', () => {
    const data = parseVCD('');
    expect(data.signals).toEqual([]);
    expect(data.endTime).toBe(0);
  });
});
