use std::path::{Path, PathBuf};
use std::process::Command;
use std::fs;

const COUNTER_VHDL: &str = r#"library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity counter is
    port (
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
"#;

const TB_COUNTER_VHDL: &str = r#"library ieee;
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
    process begin
        reset <= '1'; wait for 20 ns;
        reset <= '0'; wait for 500 ns;
        wait;
    end process;
end architecture sim;
"#;

const CHRONAM_TOML: &str = r#"[project]
name = "test-project"
version = "0.1.0"
vhdl_std = "2008"

[build]
sources = ["src/**/*.vhd", "src/**/*.vhdl"]
top_entity = "tb_counter"

[simulation]
duration_ns = 1000
wave_format = "vcd"
"#;

fn binary() -> PathBuf {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.push("target");
    p.push("debug");
    p.push(if cfg!(target_os = "windows") { "chronam.exe" } else { "chronam" });
    p
}

fn run(args: &[&str]) -> (String, String, bool) {
    let output = Command::new(binary())
        .args(args)
        .output()
        .expect("Failed to run chronam");
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let success = output.status.success();
    (stdout, stderr, success)
}

fn run_in(dir: &Path, args: &[&str]) -> (String, String, bool) {
    let output = Command::new(binary())
        .args(args)
        .current_dir(dir)
        .output()
        .expect("Failed to run chronam");
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let success = output.status.success();
    (stdout, stderr, success)
}

fn fixture_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join("chronam-tests").join(name);
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn write_fixture(dir: &Path) {
    fs::create_dir_all(dir.join("src")).unwrap();
    fs::write(dir.join("chronam.toml"), CHRONAM_TOML).unwrap();
    fs::write(dir.join("src").join("counter.vhd"), COUNTER_VHDL).unwrap();
    fs::write(dir.join("src").join("tb_counter.vhd"), TB_COUNTER_VHDL).unwrap();
}

#[test]
fn test_version() {
    let (stdout, stderr, ok) = run(&["--version"]);
    assert!(ok, "stderr: {stderr}");
    assert!(stdout.contains("chronam"), "stdout: {stdout}");
    assert!(stdout.contains("0.1.0"), "stdout: {stdout}");
}

#[test]
fn test_help() {
    let (stdout, stderr, ok) = run(&["--help"]);
    assert!(ok, "stderr: {stderr}");
    assert!(stdout.contains("Usage:"), "stdout: {stdout}");
    assert!(stdout.contains("Commands:"), "stdout: {stdout}");
    assert!(stdout.contains("new"), "stdout: {stdout}");
    assert!(stdout.contains("build"), "stdout: {stdout}");
    assert!(stdout.contains("simulate"), "stdout: {stdout}");
    assert!(stdout.contains("doctor"), "stdout: {stdout}");
    assert!(stdout.contains("test"), "stdout: {stdout}");
    assert!(stdout.contains("info"), "stdout: {stdout}");
    assert!(stdout.contains("completion"), "stdout: {stdout}");
}

#[test]
fn test_help_subcommand() {
    let (stdout, stderr, ok) = run(&["help"]);
    assert!(ok, "stderr: {stderr}");
    assert!(stdout.contains("Usage:"));
}

#[test]
fn test_info_no_project() {
    let dir = fixture_dir("info-no-project");
    let (stdout, stderr, ok) = run_in(&dir, &["info"]);
    assert!(ok, "stdout: {stdout}, stderr: {stderr}");
    assert!(stdout.contains("Project Information"), "stdout: {stdout}");
    assert!(stdout.contains("unnamed"), "stdout: {stdout}");
    fs::remove_dir_all(&dir).ok();
}

#[test]
fn test_info_with_project() {
    let dir = fixture_dir("info-with-project");
    write_fixture(&dir);
    let (stdout, stderr, ok) = run_in(&dir, &["info"]);
    assert!(ok, "stdout: {stdout}, stderr: {stderr}");
    assert!(stdout.contains("test-project"), "stdout: {stdout}");
    assert!(stdout.contains("tb_counter"), "stdout: {stdout}");
    assert!(stdout.contains("2008"), "stdout: {stdout}");
    fs::remove_dir_all(&dir).ok();
}

#[test]
fn test_doctor() {
    let (stdout, stderr, ok) = run(&["doctor"]);
    // doctor might fail if ghdl not available — that's OK, just check output format
    assert!(stdout.contains("GHDL"), "stdout: {stdout}");
    assert!(stdout.contains("Project Config"), "stdout: {stdout}");
    assert!(stdout.contains("Git"), "stdout: {stdout}");
}

#[test]
fn test_build_and_clean() {
    let dir = fixture_dir("build-and-clean");
    write_fixture(&dir);

    // Build
    let (stdout, stderr, ok) = run_in(&dir, &["build"]);
    assert!(ok, "stdout: {stdout}, stderr: {stderr}");
    assert!(stdout.contains("SUCCESS"), "stdout: {stdout}");
    assert!(stdout.contains("counter.vhd"), "stdout: {stdout}");
    assert!(stdout.contains("tb_counter.vhd"), "stdout: {stdout}");

    // Work dir exists
    assert!(dir.join(".chronam").is_dir(), "work dir should exist");

    // Clean
    let (stdout, stderr, ok) = run_in(&dir, &["clean"]);
    assert!(ok, "clean stdout: {stdout}, stderr: {stderr}");
    assert!(stdout.contains("Removed"), "clean stdout: {stdout}");
    assert!(stdout.contains("artifact"), "clean stdout: {stdout}");

    fs::remove_dir_all(&dir).ok();
}

#[test]
fn test_simulate() {
    let dir = fixture_dir("simulate");
    write_fixture(&dir);

    // Must build first
    let (_, _, ok) = run_in(&dir, &["build"]);
    assert!(ok, "build failed");

    // Simulate
    let (stdout, stderr, ok) = run_in(&dir, &["simulate"]);
    assert!(ok, "stdout: {stdout}, stderr: {stderr}");
    assert!(stdout.contains("Simulation complete"), "stdout: {stdout}");
    assert!(stdout.contains("Waveform:"), "stdout: {stdout}");
    assert!(stdout.contains(".vcd"), "stdout: {stdout}");

    // VCD file was produced
    let vcd = dir.join(".chronam").join("tb_counter.vcd");
    assert!(vcd.exists(), "VCD file should exist: {vcd:?}");

    fs::remove_dir_all(&dir).ok();
}

#[test]
fn test_simulate_with_explicit_entity() {
    let dir = fixture_dir("simulate-explicit");
    write_fixture(&dir);

    let (_, _, ok) = run_in(&dir, &["build"]);
    assert!(ok, "build failed");

    let (stdout, stderr, ok) = run_in(&dir, &["simulate", "tb_counter", "-d", "500"]);
    assert!(ok, "stdout: {stdout}, stderr: {stderr}");
    assert!(stdout.contains("Simulation complete"), "stdout: {stdout}");

    fs::remove_dir_all(&dir).ok();
}

#[test]
fn test_build_force_rebuild() {
    let dir = fixture_dir("force-rebuild");
    write_fixture(&dir);

    let (_, _, ok) = run_in(&dir, &["build"]);
    assert!(ok, "first build failed");

    let (stdout, stderr, ok) = run_in(&dir, &["build", "--force"]);
    assert!(ok, "force build stdout: {stdout}, stderr: {stderr}");
    assert!(stdout.contains("SUCCESS"), "stdout: {stdout}");

    fs::remove_dir_all(&dir).ok();
}

#[test]
fn test_completion_bash() {
    let (stdout, stderr, ok) = run(&["completion", "bash"]);
    assert!(ok, "stdout: {stdout}, stderr: {stderr}");
    assert!(!stdout.is_empty(), "completion should produce output");
    assert!(
        stdout.contains("chronam") || stdout.contains("complete"),
        "stdout should contain shell completion: {stdout}"
    );
}

#[test]
fn test_completion_fish() {
    let (stdout, stderr, ok) = run(&["completion", "fish"]);
    assert!(ok, "stdout: {stdout}, stderr: {stderr}");
    assert!(!stdout.is_empty(), "completion should produce output");
}

#[test]
fn test_completion_zsh() {
    let (stdout, stderr, ok) = run(&["completion", "zsh"]);
    assert!(ok, "stdout: {stdout}, stderr: {stderr}");
    assert!(!stdout.is_empty(), "completion should produce output");
}

#[test]
fn test_completion_powershell() {
    let (stdout, stderr, ok) = run(&["completion", "powershell"]);
    assert!(ok, "stdout: {stdout}, stderr: {stderr}");
    assert!(!stdout.is_empty(), "completion should produce output");
}
