library ieee;
use ieee.std_logic_1164.all;

entity tb_demo is
end;

architecture sim of tb_demo is

signal clk : std_logic := '0';
signal rst : std_logic := '1';

signal q : std_logic;
signal pulse : std_logic;
signal pwm : std_logic;
signal counter : std_logic_vector(7 downto 0);
signal shiftreg : std_logic_vector(7 downto 0);

begin

uut: entity work.demo

port map(

clk,
rst,

q,
pulse,
pwm,
counter,
shiftreg

);

clk <= not clk after 5 ns;

process
begin

wait for 20 ns;
rst <= '0';

wait for 5 us;

wait;

end process;

end;