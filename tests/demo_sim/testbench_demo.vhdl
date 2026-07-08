-- modify this file for simulation
-- Auto-generated testbench for demo

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity testbench_demo is
end entity;

architecture sim of testbench_demo is

  component demo is
    port (
      clk : IN std_logic;
      rst : IN std_logic;
      q : OUT std_logic;
      pulse : OUT std_logic;
      pwm : OUT std_logic;
      counter : OUT std_logic_vector(7 downto 0);
      shiftreg : OUT std_logic_vector(7 downto 0)
    );
  end component;

  -- Component signals
  signal clk : std_logic;
  signal rst : std_logic;
  signal q : std_logic;
  signal pulse : std_logic;
  signal pwm : std_logic;
  signal counter : std_logic_vector(7 downto 0);
  signal shiftreg : std_logic_vector(7 downto 0);

  -- Clock period constant
  constant CLK_PERIOD : time := 10 ns;

begin

  -- Clock generator
  clk_process : process
  begin
    while true loop
      clk <= '0';
      wait for CLK_PERIOD / 2;
      clk <= '1';
      wait for CLK_PERIOD / 2;
    end loop;
  end process;

  -- Reset stimulus
  rst_process : process
  begin
    rst <= '1';
    wait for 100 ns;
    rst <= '0';
    wait;
  end process;

  -- Stimulus process
  stimulus : process
  begin
    -- Initialize inputs
    clk <= '0';
    rst <= '0';

    wait for 100 ns;

    -- Add your stimulus here
    -- clk <= '1';
    -- rst <= '1';

    wait;
  end process;

  -- Instantiate the design under test
  uut : demo 
    port map (
      clk => clk,
      rst => rst,
      q => q,
      pulse => pulse,
      pwm => pwm,
      counter => counter,
      shiftreg => shiftreg
    );
end architecture;
