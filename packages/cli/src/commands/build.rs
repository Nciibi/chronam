use anyhow::Result;
use clap::Args;
use colored::Colorize;
use std::io::Write;
use crate::cli::Cli;
use crate::output::{step, success, error_, warn, highlight, dim};

#[derive(Args, Debug)]
pub struct BuildArgs {
    pub files: Vec<String>,
    #[arg(short = 'f', long = "force")]
    pub force: bool,
    #[arg(short = 'j', long = "jobs", default_value = "1")]
    pub jobs: u32,
    #[arg(short = 't', long = "top")]
    pub top: Option<String>,
    #[arg(short = 's', long = "std")]
    pub vhdl_std: Option<String>,
}

pub fn run(args: &BuildArgs, cli: &Cli) -> Result<()> {
    step("build", "Starting build...");
    let config = crate::project::config::load_config(cli.project.as_deref())?;

    let vhdl_std = args.vhdl_std.as_deref().unwrap_or(&config.build.vhdl_std);

    if config.build.sources.is_empty() {
        warn("No source files configured. Add files to [build.sources] in chronam.toml");
        return Ok(());
    }

    let sources = crate::project::config::resolve_sources(&config.build.sources)?;
    if sources.is_empty() {
        warn("No VHDL source files found matching the configured patterns");
        return Ok(());
    }

    step("build", &format!("Found {} source file(s)", sources.len()));

    if !crate::engine::ghdl::is_available() {
        error_("GHDL not found. Install GHDL or add it to your PATH.");
        return Ok(());
    }

    let version = crate::engine::ghdl::version()?;
    step("ghdl", &format!("GHDL {} detected", version));

    let work_dir = config.project.work_dir();
    std::fs::create_dir_all(&work_dir)?;

    if args.force {
        step("build", "Forcing full rebuild...");
        crate::engine::ghdl::clean(&work_dir)?;
    }

    let mut errors = 0;
    let mut warnings = 0;

    for source in &sources {
        let name = source.file_name().unwrap_or_default().to_string_lossy();
        print!("  {} Analyzing {} ... ", dim("["), highlight(&name));
        std::io::stdout().flush()?;

        match crate::engine::ghdl::analyze(source, &work_dir, vhdl_std) {
            Ok((e, w)) => {
                errors += e;
                warnings += w;
                if e > 0 {
                    println!("{}", "FAIL".red().bold());
                } else {
                    println!("{}", "ok".green().bold());
                }
            }
            Err(err) => {
                errors += 1;
                println!("{}", "FAIL".red().bold());
                error_(&format!("  {}", err));
            }
        }
    }

    let top = args.top.as_deref()
        .or(config.build.top_entity.as_deref())
        .unwrap_or("");

    if !top.is_empty() && errors == 0 {
        step("elab", &format!("Elaborating {} ...", highlight(top)));
        match crate::engine::ghdl::elaborate(top, &work_dir, vhdl_std) {
            Ok((e, w)) => {
                errors += e;
                warnings += w;
                if e > 0 {
                    error_("Elaboration failed");
                } else {
                    success("elab", "Elaboration complete");
                }
            }
            Err(err) => {
                errors += 1;
                error_(&format!("Elaboration failed: {}", err));
            }
        }
    } else if top.is_empty() {
        warn("No top entity configured. Set [build.top_entity] in chronam.toml or pass --top");
    }

    println!();
    let status = if errors > 0 {
        "FAILED".red().bold().to_string()
    } else {
        "SUCCESS".green().bold().to_string()
    };
    println!(
        "  {}  {}  |  {}  {}  |  {} {}",
        dim("build:"),
        status,
        format!("{} error(s)", errors).red(),
        dim("|"),
        format!("{} warning(s)", warnings).yellow(),
        dim(&format!("({} file(s))", sources.len()))
    );

    if errors > 0 {
        std::process::exit(1);
    }
    Ok(())
}
