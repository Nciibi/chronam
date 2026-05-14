-- WaveForge Test Fixture: 4-bit Counter
-- A simple counter design for testing the simulation pipeline.

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity counter is
    port(
        clk   : in  std_logic;
        reset : in  std_logic;
        q     : out std_logic_vector(3 downto 0)
    );
end entity counter;

architecture rtl of counter is
    signal count : unsigned(3 downto 0) := (others => '0');
begin
    process(clk, reset)
    begin
        if reset = '1' then
            count <= (others => '0');
        elsif rising_edge(clk) then
            count <= count + 1;
        end if;
    end process;

    q <= std_logic_vector(count);
end architecture rtl;
