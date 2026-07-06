library ieee;
use ieee.std_logic_1164.all;

entity tb_counter is
end entity tb_counter;

architecture sim of tb_counter is
    signal clk   : std_logic := '0';
    signal reset : std_logic := '0';
    signal q     : std_logic_vector(3 downto 0);
begin
    uut: entity work.counter
        port map (clk => clk, reset => reset, q => q);

    clk <= not clk after 5 ns;

    process
    begin
        reset <= '1';
        wait for 20 ns;
        reset <= '0';
        wait for 500 ns;
        wait;
    end process;
end architecture sim;
