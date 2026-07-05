import { SimulationOrchestrator } from './packages/core/src/orchestrator.js';
import * as fs from 'fs/promises';

async function main() {
  let log = '';
  const delegate = {
    onStatusChange: (s: any) => console.log('STATUS:', s),
    onLogInfo: (m: string, ...args: any[]) => console.log('INFO:', m, ...args),
    onLogError: (m: string, ...args: any[]) => console.error('ERROR:', m, ...args),
    promptEntitySelection: async (e: any) => e[0],
    getSimulationConfig: () => ({ durationNs: 1000, clockPeriodNs: 10, ghdlPath: 'D:\\ghdl\\bin\\ghdl.exe' }),
    readFile: async (p: string) => fs.readFile(p, 'utf-8'),
  };

  const orchestrator = new SimulationOrchestrator(delegate);
  const filePath = 'd:\\projects\\chronam\\tools\\fixtures\\counter.vhdl';
  const fileContent = await fs.readFile(filePath, 'utf-8');
  const workDir = 'd:\\projects\\chronam\\tools\\fixtures\\.chronam';

  const result = await orchestrator.runSimulation(
    fileContent,
    filePath,
    workDir,
    (phase, detail) => console.log(`[${phase}] ${detail}`)
  );

  console.log('Result:', result.error ? 'ERROR: ' + result.error : 'SUCCESS');
}

main().catch(console.error);
