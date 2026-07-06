use anyhow::Result;
use clap::Args;
use crate::Cli;
use crate::output::{step, success, error_, warn, highlight, dim};
use crate::engine::ghdl;

#[derive(Args, Debug)]
pub struct BuildArgs {
    /// Specific source files to build (default: all from chronam.toml)
    pub files: Vec<String>,

    /// Rebuild from scratch
    #[arg(short = 'f', long = "force")]
    pub force: bool,

    /// Number of parallel jobs
    #[arg(short = 'j', long = "jobs", default_value = "1")]
    pub jobs: u32,
}

pub fn run(args: &BuildArgs, cli: &Cli) -> Result<()> {
    let _ = args;
    let _ = cli;

    step("build", "Starting build...");

    // Load project config
    let config = crate::project::config::load_config(cli.project.as_deref())?;

    if config.build.sources.is_empty() {
        warn("No source files configured. Add files to [build.sources] in chronam.toml");
        return Ok(());
    }

    // Resolve source files from glob patterns
    let sources = crate::project::config::resolve_sources(&config.build.sources)?;

    if sources.is_empty() {
        warn("No VHDL source files found matching the configured patterns");
        return Ok(());
    }

    step("build", &format!("Found {} source file(s)", sources.len()));

    // Check if GHDL is available
    if !ghdl::is_available() {
        error_("GHDL not found. Install GHDL or add it to your PATH.");
        return Ok(());
    }

    let version = ghdl::version()?;
    step("ghdl", &format!("GHDL {} detected", version));

    // Analyze each source file
    let work_dir = config.project.work_dir();
    std::fs::create_dir_all(&work_dir)?;

    if args.force {
        step("build", "Forcing full rebuild...");
        ghdl::clean(&work_dir)?;
    }

    let mut errors = 0;
    let mut warnings = 0;

    for source in &sources {
        let name = source.file_name().unwrap_or_default().to_string_lossy();
        print!("  {} Analyzing {} ... ", dim("["), highlight(&name));
        std::io::stdout().flush()?;

        match ghdl::analyze(source, &work_dir, &config.build.vhdl_std) {
            Ok((e, w)) => {
                errors += e;
                warnings += w;
                if e > 0 {
                    println!("{}", colored::Colorize::red("FAIL").bold());
                } else {
                    println!("{}", colored::Colorize::green("ok").bold());
                }
            }
            Err(err) => {
                errors += 1;
                println!("{}", colored::Colorize::red("FAIL").bold());
                error_(&format!("  {}", err));
            }
        }
    }

    // Elaborate top entity
    if let Some(top) = &config.build.top_entity {
        if !top.is_empty() {
            step("elab", &format!("Elaborating {} ...", highlight(top)));
            match ghdl::elaborate(top, &work_dir, &config.build.vhdl_std) {
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
        } else {
            warn("No top entity configured. Set [build.top_entity] in chronam.toml");
        }
    }

    // Summary
    println!();
    let status = if errors > 0 {
        colored::Colorize::red("FAILED").bold().to_string()
    } else {
        colored::Colorize::green("SUCCESS").bold().to_string()
    };
    println!(
        "  {}  {}  |  {}  {}  |  {} {}",
        dim("build:"),
        status,
        colored::Colorize::red(&format!("{} error(s)", errors)),
        dim("|"),
        colored::Colorize::yellow(&format!("{} warning(s)", warnings)),
        dim(&format!("({} file(s))", sources.len()))
    );

    if errors > 0 {
        std::process::exit(1);
    }

    Ok(())
}

use std::io::Write;
