-- Auto-generated testbench by Chronam
-- Entity: counter
-- Generated: 2026-07-05T15:13:23.444Z

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

    -- Device Under Test
    uut : entity work.counter
        port map (
            clk => clk,
            reset => reset,
            q => q
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
        -- Reset sequence
        reset <= '1';
        wait for 20 ns;
        reset <= '0';

        -- Run simulation for 1000 ns
        wait for 1000 ns;

        -- End simulation
        sim_done <= true;
        wait;
    end process;

end architecture sim;
