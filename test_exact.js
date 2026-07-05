// Replicates the EXACT VS Code extension code path
const path = require('path');
const fs = require('fs/promises');
const { spawn } = require('child_process');
const os = require('os');

const workDir = path.resolve(__dirname, 'tools/fixtures/.chronam');
const designFilePath = path.resolve(__dirname, 'tools/fixtures/counter.vhdl');

async function runProcess(command, args, options) {
  return new Promise((resolve, reject) => {
    const {cwd, timeoutMs=60000, env, signal, onStdout, onStderr} = options;
    let child, timedOut=false, killed=false;
    try {
      console.log(`[DEBUG] RUNNING: ${command} ${args.join(' ')} (cwd: ${cwd})`);
      child = spawn(command, args, {
        cwd,
        env: env ? {...process.env, ...env} : process.env,
        shell: process.platform === 'win32', // <-- TRY WITH shell: true ON WINDOWS
        stdio: ['pipe','pipe','pipe'],
      });
    } catch(err) {
      reject(new Error(`Failed to spawn: ${err}`));
      return;
    }
    let stdout='', stderr='';
    child.stdout.on('data', d => { stdout+=d.toString(); });
    child.stderr.on('data', d => { stderr+=d.toString(); });
    const timer = setTimeout(() => { timedOut=true; child.kill('SIGTERM'); }, timeoutMs);
    child.on('error', err => { clearTimeout(timer); reject(err); });
    child.on('exit', code => {
      clearTimeout(timer);
      resolve({ exitCode: code??1, stdout, stderr, timedOut, killed });
    });
  });
}

const ghdl = 'ghdl';
const VHDL_STD_MAP = { '2008': '08' };

async function analyze(sources, workDir, vhdlVersion='2008') {
  await fs.mkdir(workDir, { recursive: true });
  for (const source of sources) {
    const args = ['-a', `--std=${VHDL_STD_MAP[vhdlVersion]}`, `--workdir=${workDir}`, source];
    const result = await runProcess(ghdl, args, { cwd: workDir, timeoutMs: 30000 });
    console.log(`ANALYZE ${path.basename(source)}: exit=${result.exitCode} stderr=${result.stderr.trim()}`);
    if (result.exitCode !== 0) return result;
  }
  return { exitCode: 0, stdout: '', stderr: '' };
}

async function elaborate(topEntity, workDir, vhdlVersion='2008') {
  const args = ['-e', `--std=${VHDL_STD_MAP[vhdlVersion]}`, `--workdir=${workDir}`, topEntity];
  const result = await runProcess(ghdl, args, { cwd: workDir, timeoutMs: 30000 });
  console.log(`ELABORATE ${topEntity}: exit=${result.exitCode} stderr=${result.stderr.trim()}`);
  return result;
}

async function main() {
  console.log('=== TEST 1: shell: true (matching original win32 behavior) ===');
  // override runProcess with shell: true
  // Actually let's just test one specific thing:
  console.log('platform:', process.platform);
  console.log('workDir:', workDir);
  console.log('workDir exists:', await fs.access(workDir).then(()=>true).catch(()=>false));

  // Clean
  try { await fs.rm(workDir, { recursive: true }); } catch(e) {}
  await fs.mkdir(workDir, { recursive: true });

  // Write testbench
  const fileContent = await fs.readFile(designFilePath, 'utf-8');
  const tbContent = `-- Auto-generated testbench
library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity tb_counter is
end entity tb_counter;

architecture sim of tb_counter is
    signal clk : std_logic := '0';
    signal reset : std_logic := '0';
    signal q : std_logic_vector(3 downto 0) := (others => '0');
    constant CLK_PERIOD : time := 10 ns;
    constant CLK_HALF   : time := 5 ns;
    signal sim_done : boolean := false;
begin
    uut : entity work.counter
        port map (
            clk => clk,
            reset => reset,
            q => q
        );
    clk_proc : process
    begin
        while not sim_done loop
            clk <= '0';
            wait for CLK_HALF;
            clk <= '1';
            wait for CLK_HALF;
        end loop;
        wait;
    end process;
    stim_proc : process
    begin
        reset <= '1';
        wait for 20 ns;
        reset <= '0';
        wait for 1000 ns;
        sim_done <= true;
        wait;
    end process;
end architecture sim;`;
  const tbFilePath = path.join(workDir, 'tb_counter.vhd');
  await fs.writeFile(tbFilePath, tbContent, 'utf-8');

  // Analyze design
  const r1 = await analyze([designFilePath], workDir, '2008');
  if (r1.exitCode !== 0) { console.log('FAIL at design analysis'); return; }

  // Analyze testbench
  const r2 = await analyze([tbFilePath], workDir, '2008');
  if (r2.exitCode !== 0) { console.log('FAIL at tb analysis'); return; }

  // Show cf file
  const cfPath = path.join(workDir, 'work-obj08.cf');
  const cf = await fs.readFile(cfPath, 'utf-8');
  console.log('CF file contents:');
  console.log(cf);

  // Elaborate
  const r3 = await elaborate('tb_counter', workDir, '2008');
  if (r3.exitCode !== 0) { console.log('FAIL at elaboration'); return; }

  console.log('=== ALL PASSED ===');
}

main().catch(console.error);
