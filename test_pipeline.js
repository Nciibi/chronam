const path = require('path');
const fs = require('fs');

// Run from packages/core so node_modules resolves correctly
process.chdir(path.resolve(__dirname, 'packages/core'));

const { SimulationOrchestrator } = require('./dist/index.js');

async function main() {
  const delegate = {
    onStatusChange: (s) => console.log('STATUS:', JSON.stringify(s)),
    onLogInfo: (m, ...args) => console.log('INFO:', m, ...args),
    onLogError: (m, ...args) => console.error('ERROR:', m, ...args),
    promptEntitySelection: async (e) => e[0],
    getSimulationConfig: () => ({ durationNs: 1000, clockPeriodNs: 10 }),
    readFile: async (p) => fs.promises.readFile(p, 'utf-8'),
  };

  const orch = new SimulationOrchestrator(delegate);
  const rootDir = path.resolve(__dirname, '../..');
  const filePath = path.resolve(rootDir, 'tools/fixtures/counter.vhdl');
  const fileContent = await fs.promises.readFile(filePath, 'utf-8');
  const workDir = path.resolve(rootDir, 'tools/fixtures/.chronam');

  // Clean slate
  try { fs.rmSync(workDir, { recursive: true }); } catch(e) {}
  fs.mkdirSync(workDir, { recursive: true });

  console.log('filePath:', filePath);
  console.log('workDir:', workDir);
  console.log('');

  const result = await orch.runSimulation(
    fileContent, filePath, workDir,
    (phase, detail) => console.log('[' + phase + '] ' + detail),
    (line) => console.log('  GHDL:', line)
  );

  if (result.error) {
    console.log('FAILED:', result.error);
  } else if (result.waveformData) {
    console.log('SUCCESS: ' + result.waveformData.signals.length + ' signals');
  } else {
    console.log('SUCCESS (no waveform)');
  }
}

main().catch(console.error);
