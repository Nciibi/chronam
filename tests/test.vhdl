library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity demo is
port(
    clk      : in  std_logic;
    rst      : in  std_logic;

    q        : out std_logic;
    pulse    : out std_logic;
    pwm      : out std_logic;
    counter  : out std_logic_vector(7 downto 0);
    shiftreg : out std_logic_vector(7 downto 0)
);
end;

architecture rtl of demo is

signal cnt : unsigned(7 downto 0) := (others=>'0');
signal tff : std_logic := '0';
signal sh  : std_logic_vector(7 downto 0):="00000001";

begin

process(clk)

begin
    if rising_edge(clk) then

        if rst='1' then
            cnt <= (others=>'0');
            tff <= '0';
            sh <= "00000001";

        else

            cnt <= cnt + 1;

            if cnt(3 downto 0)="1111" then
                tff <= not tff;
            end if;

            sh <= sh(6 downto 0) & sh(7);

        end if;

    end if;
end process;

counter <= std_logic_vector(cnt);

q <= tff;

pulse <= '1' when cnt=80 else '0';

pwm <= '1' when cnt(7 downto 4)<6 else '0';

shiftreg <= sh;

end rtl;