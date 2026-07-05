const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const workDir = path.resolve(__dirname, 'tools/fixtures/.chronam');
const designFile = path.resolve(__dirname, 'tools/fixtures/counter.vhdl');
const tbPath = path.join(workDir, 'tb_counter.vhd');
const ghdl = 'D:\\ghdl\\bin\\ghdl.exe';

// Clean slate
try { fs.rmSync(workDir, { recursive: true }); } catch(e) {}
fs.mkdirSync(workDir, { recursive: true });

// Write minimal testbench
const tb = `-- testbench
library ieee;
use ieee.std_logic_1164.all;
entity tb_counter is
end entity;
architecture sim of tb_counter is
begin
end architecture;`;
fs.writeFileSync(tbPath, tb, 'utf-8');

async function run() {
  for (const args of [
    ['-a', '--std=08', '--workdir=' + workDir, designFile],
    ['-a', '--std=08', '--workdir=' + workDir, tbPath],
    ['-e', '--std=08', '--workdir=' + workDir, 'tb_counter'],
  ]) {
    const p = spawn(ghdl, args, { cwd: workDir, shell: false, stdio: 'pipe', env: process.env });
    let out = '', err = '';
    p.stdout.on('data', d => out += d);
    p.stderr.on('data', d => err += d);
    await new Promise(r => p.on('close', code => {
      console.log(`CMD: ${ghdl} ${args.join(' ')}`);
      console.log(`CODE: ${code} STDERR: ${err.trim()}`);
      r();
    }));
    if (err) break;
  }
}
run().catch(console.error);
