use anyhow::{Result, Context, bail};
use clap::Args;
use std::path::PathBuf;
use crate::cli::Cli;
use crate::output::{step, success, highlight, dim};

#[derive(Args, Debug)]
pub struct NewArgs {
    pub name: String,
    #[arg(short = 'd', long = "dir")]
    pub directory: Option<PathBuf>,
    #[arg(short = 's', long = "std", default_value = "2008")]
    pub vhdl_std: String,
    #[arg(long = "example", default_value = "true")]
    pub example: bool,
}

pub fn run(args: &NewArgs, _cli: &Cli) -> Result<()> {
    let dir = args.directory.clone().unwrap_or_else(|| PathBuf::from(&args.name));

    if dir.exists() {
        bail!("Directory '{}' already exists", dir.display());
    }

    step("project", "Creating project structure...");

    let src_dir = dir.join("src");
    std::fs::create_dir_all(&src_dir)
        .with_context(|| format!("Failed to create {}", src_dir.display()))?;

    let build_dir = dir.join("build");
    std::fs::create_dir_all(&build_dir)
        .with_context(|| format!("Failed to create {}", build_dir.display()))?;

    let manifest = format!(
        r#"[project]
name = "{}"
version = "0.1.0"
vhdl_std = "{}"

[build]
sources = ["src/**/*.vhd", "src/**/*.vhdl"]
top_entity = ""

[simulation]
duration_ns = 1000
wave_format = "vcd"
"#,
        args.name, args.vhdl_std
    );
    std::fs::write(dir.join("chronam.toml"), &manifest)
        .with_context(|| "Failed to write chronam.toml")?;

    if args.example {
        let example = r#"library ieee;
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
        let example_path = src_dir.join(format!("{}.vhd", args.name));
        std::fs::write(&example_path, example)
            .with_context(|| format!("Failed to write {}", example_path.display()))?;
    }

    success("done", &format!("Created project '{}' at {}", highlight(&args.name), highlight(&dir.display().to_string())));
    println!();
    println!("  {} Next steps:", dim("·"));
    println!("    {} {}", dim("·"), dim(&format!("cd {}", dir.display())));
    println!("    {} {}", dim("·"), dim("chronam build    # Compile the design"));
    println!("    {} {}", dim("·"), dim("chronam sim      # Run simulation"));
    println!("    {} {}", dim("·"), dim("chronam doctor   # Check environment"));
    Ok(())
}
