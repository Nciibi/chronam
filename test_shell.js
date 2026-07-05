const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const workDir = path.resolve(__dirname, 'tools/fixtures/.chronam');
const designFile = path.resolve(__dirname, 'tools/fixtures/counter.vhdl');
const tbFile = path.join(workDir, 'tb_counter.vhd');
const ghdl = 'ghdl';

// Clean slate
try { fs.rmSync(workDir, { recursive: true }); } catch(e) {}
fs.mkdirSync(workDir, { recursive: true });

// Write testbench
const tbSource = `-- Auto-generated testbench
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
        port map (clk => clk, reset => reset, q => q);
    clk_proc : process
    begin
        while not sim_done loop
            clk <= '0'; wait for CLK_HALF;
            clk <= '1'; wait for CLK_HALF;
        end loop; wait;
    end process;
    stim_proc : process
    begin
        reset <= '1'; wait for 20 ns;
        reset <= '0'; wait for 1000 ns;
        sim_done <= true; wait;
    end process;
end architecture sim;`;
fs.writeFileSync(tbFile, tbSource, 'utf-8');

async function run(label, args, useShell) {
  return new Promise(r => {
    console.log(`\n--- ${label} (shell:${useShell})`);
    console.log(`CMD: ${ghdl} ${args.join(' ')}`);
    const p = spawn(ghdl, args, { cwd: workDir, shell: useShell, stdio: 'pipe' });
    let out='', err='';
    p.stdout.on('data', d => { out+=d; process.stdout.write('out:'+d); });
    p.stderr.on('data', d => { err+=d; process.stderr.write('err:'+d); });
    p.on('close', code => {
      console.log(`\nCODE: ${code} stderr: ${err.trim()}`);
      r({ code, out, err });
    });
  });
}

async function main() {
  // First with shell:false
  console.log('=== SHELL:FALSE ===');
  const r1a = await run('analyze design', ['-a', '--std=08', `--workdir=${workDir}`, designFile], false);
  if (r1a.code !== 0) return;
  const r2a = await run('analyze tb', ['-a', '--std=08', `--workdir=${workDir}`, tbFile], false);
  if (r2a.code !== 0) return;
  const r3a = await run('elaborate', ['-e', '--std=08', `--workdir=${workDir}`, 'tb_counter'], false);
  if (r3a.code !== 0) { console.log('FAILED with shell:false'); return; }

  // Clean and try shell:true
  try { fs.rmSync(workDir, { recursive: true }); } catch(e) {}
  fs.mkdirSync(workDir, { recursive: true });
  fs.writeFileSync(tbFile, tbSource, 'utf-8');

  console.log('\n\n=== SHELL:TRUE ===');
  const r1b = await run('analyze design', ['-a', '--std=08', `--workdir=${workDir}`, designFile], true);
  if (r1b.code !== 0) return;
  const r2b = await run('analyze tb', ['-a', '--std=08', `--workdir=${workDir}`, tbFile], true);
  if (r2b.code !== 0) return;
  const r3b = await run('elaborate', ['-e', '--std=08', `--workdir=${workDir}`, 'tb_counter'], true);
  if (r3b.code !== 0) { console.log('FAILED with shell:true'); return; }

  console.log('\n=== BOTH PASSED ===');
}
main().catch(console.error);
