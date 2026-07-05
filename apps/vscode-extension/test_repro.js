// Replicate EXACT VS Code extension code path
// Run from apps/vscode-extension/ so module resolution matches the extension
const path = require('path');
const fs = require('fs');

// Set up the environment like VS Code extension host
process.env.PATH = process.env.PATH; // keep as-is
process.chdir(__dirname);

async function main() {
  // 1. Read the test file
  const filePath = path.resolve(__dirname, '../../tools/fixtures/counter.vhdl');
  const fileContent = await fs.promises.readFile(filePath, 'utf-8');
  const workDir = path.join(path.dirname(filePath), '.chronam');

  // Clean slate
  try { fs.rmSync(workDir, { recursive: true }); } catch(e) {}
  fs.mkdirSync(workDir, { recursive: true });

  // 2. Load the exact same modules the extension uses
  const { SimulationOrchestrator } = require('@chronam/core');
  const { createDefaultSimConfig, createDefaultClock } = require('@chronam/shared-types');

  const delegate = {
    onStatusChange: (s) => console.log('STATUS:', JSON.stringify(s)),
    onLogInfo: (m, ...args) => console.log('INFO:', m, ...args),
    onLogError: (m, ...args) => console.error('ERROR:', m, ...args),
    promptEntitySelection: async (e) => e[0],
    getSimulationConfig: () => ({ durationNs: 1000, clockPeriodNs: 10 }),
    readFile: async (p) => fs.promises.readFile(p, 'utf-8'),
  };

  const orchestrator = new SimulationOrchestrator(delegate);

  console.log('filePath:', filePath);
  console.log('workDir:', workDir);
  console.log('');

  const result = await orchestrator.runSimulation(
    fileContent, filePath, workDir,
    (phase, detail) => console.log('[' + phase + '] ' + detail),
    (line) => console.log('GHDL:', line)
  );

  console.log('');
  if (result.error) {
    console.log('FAILED:', result.error);
  } else if (result.waveformData) {
    console.log('SUCCESS: ' + result.waveformData.signals.length + ' signals');
  } else {
    console.log('SUCCESS (no waveform)');
  }
}

main().catch(console.error);
