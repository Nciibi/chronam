use anyhow::Result;
use clap::Args;
use colored::Colorize;
use std::io::Write;
use crate::cli::Cli;
use crate::output::{step, success, error_, highlight, dim};

#[derive(Args, Debug)]
pub struct SimulateArgs {
    pub entity: Option<String>,
    #[arg(short = 'd', long = "duration", default_value = "1000")]
    pub duration_ns: u64,
    #[arg(short = 'w', long = "wave", default_value = "vcd")]
    pub wave_format: String,
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

    if !crate::engine::ghdl::is_available() {
        error_("GHDL not found. Install GHDL or add it to your PATH.");
        return Ok(());
    }

    let work_dir = config.project.work_dir();
    let sources = crate::project::config::resolve_sources(&config.build.sources, config.config_dir.as_ref())?;

    step("sim", "Analyzing design files...");
    for source in &sources {
        let name = source.file_name().unwrap_or_default().to_string_lossy();
        print!("  {} {} ... ", dim("["), name);
        std::io::stdout().flush()?;
        match crate::engine::ghdl::analyze(source, &work_dir, &config.build.vhdl_std) {
            Ok((e, _)) => {
                if e > 0 { println!("{}", "FAIL".red()); }
                else { println!("{}", "ok".green()); }
            }
            Err(e) => {
                println!("{}", "FAIL".red());
                error_(&format!("  {}", e));
                if args.halt_on_error { return Ok(()); }
            }
        }
    }

    step("sim", &format!("Elaborating {} ...", highlight(top)));
    match crate::engine::ghdl::elaborate(top, &work_dir, &config.build.vhdl_std) {
        Ok((_, _)) => {},
        Err(e) => {
            error_(&format!("Elaboration failed: {}", e));
            return Ok(());
        }
    }

    step("sim", "Running simulation...");
    let vcd_path = match crate::engine::ghdl::run(top, &work_dir, &config.build.vhdl_std, args.duration_ns, &args.wave_format) {
        Ok(path) => {
            success("sim", &format!("Simulation complete ({})", dim(&format!("{}ns", args.duration_ns))));
            path
        }
        Err(e) => {
            error_(&format!("Simulation failed: {}", e));
            return Ok(());
        }
    };

    if let Some(ref vcd) = vcd_path {
        if !vcd.is_empty() {
            println!("  {} Waveform: {}", dim("└"), highlight(vcd));
            println!();
            match crate::vcd::parse(std::path::Path::new(vcd)) {
                Ok(data) => {
                    let view_ns = args.duration_ns.min(200);
                    let diagram = crate::vcd::render_timing_diagram(&data, &[], view_ns);
                    println!("{}", diagram);
                }
                Err(e) => {
                    error_(&format!("Failed to render waveform: {}", e));
                }
            }
        }
    }

    Ok(())
}
