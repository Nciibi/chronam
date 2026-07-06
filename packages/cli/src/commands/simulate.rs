use anyhow::Result;
use clap::Args;
use crate::Cli;
use crate::output::{step, success, error_, warn, highlight, dim};
use crate::engine::ghdl;

#[derive(Args, Debug)]
pub struct SimulateArgs {
    /// Top-level entity to simulate
    pub entity: Option<String>,

    /// Simulation duration in nanoseconds
    #[arg(short = 'd', long = "duration", default_value = "1000")]
    pub duration_ns: u64,

    /// Waveform output format
    #[arg(short = 'w', long = "wave", default_value = "vcd")]
    pub wave_format: String,

    /// Stop on error
    #[arg(long = "halt-on-error")]
    pub halt_on_error: bool,
}

pub fn run(args: &SimulateArgs, cli: &Cli) -> Result<()> {
    let config = crate::project::config::load_config(cli.project.as_deref())?;

    let top = args.entity.as_deref()
        .or(config.build.top_entity.as_deref())
        .unwrap_or("");

    if top.is_empty() {
        error_("No top entity specified. Provide an entity name or set [build.top_entity] in chronam.toml");
        return Ok(());
    }

    step("sim", &format!("Starting simulation of {} ...", highlight(top)));

    if !ghdl::is_available() {
        error_("GHDL not found");
        return Ok(());
    }

    let work_dir = config.project.work_dir();
    let sources = crate::project::config::resolve_sources(&config.build.sources)?;

    // Analyze sources
    step("sim", "Analyzing design files...");
    for source in &sources {
        let name = source.file_name().unwrap_or_default().to_string_lossy();
        print!("  {} {} ... ", dim("["), name);
        std::io::stdout().flush()?;
        match ghdl::analyze(source, &work_dir, &config.build.vhdl_std) {
            Ok((e, _)) => {
                if e > 0 { println!("{}", colored::Colorize::red("FAIL")); }
                else { println!("{}", colored::Colorize::green("ok")); }
            }
            Err(e) => {
                println!("{}", colored::Colorize::red("FAIL"));
                error_(&format!("  {}", e));
                if args.halt_on_error { return Ok(()); }
            }
        }
    }

    // Elaborate
    step("sim", &format!("Elaborating {} ...", highlight(top)));
    ghdl::elaborate(top, &work_dir, &config.build.vhdl_std)?;

    // Run
    step("sim", "Running simulation...");
    match ghdl::run(top, &work_dir, &config.build.vhdl_std, args.duration_ns, &args.wave_format) {
        Ok(vcd_path) => {
            success("sim", &format!("Simulation complete ({})", dim(&format!("{}ns", args.duration_ns))));
            let vcd = vcd_path.unwrap_or_default();
            if !vcd.is_empty() {
                println!("  {} Waveform: {}", dim("└"), highlight(&vcd));
            }
        }
        Err(e) => {
            error_(&format!("Simulation failed: {}", e));
        }
    }

    Ok(())
}

use std::io::Write;
