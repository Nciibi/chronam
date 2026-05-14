-- Chronam Test Fixture: ALU
-- A more complex design for testing multi-port entity parsing.

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity alu is
    port(
        clk    : in  std_logic;
        a      : in  std_logic_vector(7 downto 0);
        b      : in  std_logic_vector(7 downto 0);
        op     : in  std_logic_vector(1 downto 0);
        result : out std_logic_vector(7 downto 0);
        zero   : out std_logic;
        carry  : out std_logic
    );
end entity alu;

architecture behavioral of alu is
    signal res_internal : unsigned(8 downto 0);
begin
    process(clk)
    begin
        if rising_edge(clk) then
            case op is
                when "00" =>
                    res_internal <= ('0' & unsigned(a)) + ('0' & unsigned(b));
                when "01" =>
                    res_internal <= ('0' & unsigned(a)) - ('0' & unsigned(b));
                when "10" =>
                    res_internal <= '0' & unsigned(a and b);
                when "11" =>
                    res_internal <= '0' & unsigned(a or b);
                when others =>
                    res_internal <= (others => '0');
            end case;
        end if;
    end process;

    result <= std_logic_vector(res_internal(7 downto 0));
    carry  <= res_internal(8);
    zero   <= '1' when res_internal(7 downto 0) = x"00" else '0';
end architecture behavioral;
