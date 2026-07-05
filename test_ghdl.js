const path = require('path');
const { spawn } = require('child_process');

const workDir = path.resolve(__dirname, 'tools/fixtures/.chronam');
const designFile = path.resolve(__dirname, 'tools/fixtures/counter.vhdl');
const tbFile = path.join(workDir, 'tb_counter.vhd');
const ghdl = 'ghdl';

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n--- ${cmd} ${args.join(' ')}`);
    const p = spawn(cmd, args, { cwd: workDir, shell: false, stdio: 'pipe' });
    let stdout = '', stderr = '';
    p.stdout.on('data', d => { stdout += d.toString(); process.stdout.write('OUT:' + d); });
    p.stderr.on('data', d => { stderr += d.toString(); process.stderr.write('ERR:' + d); });
    p.on('exit', code => {
      console.log(`EXIT: ${code}`);
      resolve({ code, stdout, stderr });
    });
    p.on('error', reject);
  });
}

async function main() {
  console.log('workDir:', workDir);
  console.log('designFile:', designFile);
  console.log('tbFile:', tbFile);

  // Clean
  const fs = require('fs');
  try {
    for (const f of fs.readdirSync(workDir)) {
      if (/\.(o|cf|vcd|ghw)$/i.test(f)) fs.unlinkSync(path.join(workDir, f));
    }
  } catch (e) { /* ok */ }
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
  fs.writeFileSync(tbFile, tbSource, 'utf-8');

  // Run GHDL pipeline
  const r1 = await run(ghdl, ['-a', '--std=08', `--workdir=${workDir}`, designFile]);
  if (r1.code !== 0) { console.log('FAIL at analyze design'); return; }

  const r2 = await run(ghdl, ['-a', '--std=08', `--workdir=${workDir}`, tbFile]);
  if (r2.code !== 0) { console.log('FAIL at analyze tb'); return; }

  const r3 = await run(ghdl, ['-e', '--std=08', `--workdir=${workDir}`, 'tb_counter']);
  if (r3.code !== 0) { console.log('FAIL at elaborate'); return; }

  const r4 = await run(ghdl, ['-r', '--std=08', `--workdir=${workDir}`, 'tb_counter', '--stop-time=1000ns', `--vcd=${path.join(workDir, 'tb_counter.vcd')}`]);
  if (r4.code !== 0) { console.log('FAIL at run'); return; }

  console.log('\n=== ALL PASSED ===');
}

main().catch(console.error);
