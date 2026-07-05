import { SimulationEngine } from './packages/simulation-engine/src/engine.js';
import * as fs from 'fs/promises';
import * as path from 'path';

async function main() {
  const engine = new SimulationEngine('ghdl');
  
  const designSource = 'd:\\projects\\chronam\\tools\\fixtures\\counter.vhdl';
  const tbSource = await fs.readFile('d:\\projects\\chronam\\tools\\fixtures\\.chronam\\tb_counter.vhd', 'utf-8');
  
  const workDir = 'd:\\projects\\chronam\\tools\\fixtures\\.chronam';
  
  const result = await engine.runSimulation(
    designSource,
    tbSource,
    'tb_counter',
    { durationNs: 1000, clockPeriodNs: 10, clocks: [], stimuli: [], waveFormat: 'vcd', extraFlags: [] },
    workDir,
    (phase, detail) => console.log(`[${phase}] ${detail}`)
  );
  
  console.log('Result:', result.status);
  console.log('Errors:', result.errors);
}

main().catch(console.error);
