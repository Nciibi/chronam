-- Auto-generated testbench by Chronam
-- Entity: tb_counter
-- Generated: 2026-07-06T00:25:23.340Z

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity tb_tb_counter is
end entity tb_tb_counter;

architecture sim of tb_tb_counter is


    signal sim_done : boolean := false;

begin

    -- Device Under Test
    uut : entity work.tb_counter
        ;

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
