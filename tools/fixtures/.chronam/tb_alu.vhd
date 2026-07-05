-- Auto-generated testbench by Chronam
-- Entity: alu
-- Generated: 2026-07-05T15:00:33.430Z

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity tb_alu is
end entity tb_alu;

architecture sim of tb_alu is

    signal clk : std_logic := '0';
    signal a : std_logic_vector(7 downto 0 := '0';

    constant CLK_PERIOD : time := 10 ns;
    constant CLK_HALF   : time := 5 ns;

    signal sim_done : boolean := false;

begin

    -- Device Under Test
    uut : entity work.alu
        port map (
            clk => clk,
            a => a
        );

    -- Clock process: clk
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

    -- Stimulus process
    stim_proc : process
    begin
        -- Run simulation for 1000 ns
        wait for 1000 ns;

        -- End simulation
        sim_done <= true;
        wait;
    end process;

end architecture sim;
