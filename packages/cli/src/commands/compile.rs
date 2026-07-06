use anyhow::Result;
use clap::Args;
use crate::Cli;
use crate::output::{step, success, error_, warn, highlight, dim};
use crate::engine::ghdl;

#[derive(Args, Debug)]
pub struct CompileArgs {
    /// Specific files to compile (default: all sources)
    pub files: Vec<String>,

    /// Top-level entity for elaboration
    #[arg(short = 't', long = "top")]
    pub top: Option<String>,

    /// VHDL standard
    #[arg(short = 's', long = "std", default_value = "2008")]
    pub vhdl_std: String,

    /// Force recompilation
    #[arg(short = 'f', long = "force")]
    pub force: bool,
}

pub fn run(args: &CompileArgs, cli: &Cli) -> Result<()> {
    let config = crate::project::config::load_config(cli.project.as_deref())?;
    let sources = if args.files.is_empty() {
        crate::project::config::resolve_sources(&config.build.sources)?
    } else {
        args.files.iter().map(std::path::PathBuf::from).collect()
    };

    step("comp", &format!("Compiling {} file(s)...", sources.len()));

    if !ghdl::is_available() {
        error_("GHDL not found");
        return Ok(());
    }

    let work_dir = config.project.work_dir();
    if args.force {
        ghdl::clean(&work_dir)?;
    }

    let mut errors = 0;
    for source in &sources {
        let name = source.file_name().unwrap_or_default().to_string_lossy();
        print!("  {} ", highlight(&name));
        std::io::stdout().flush()?;

        match ghdl::analyze(source, &work_dir, &args.vhdl_std) {
            Ok((e, w)) => {
                errors += e;
                if e > 0 {
                    println!(" {}", colored::Colorize::red("✗").bold());
                } else if w > 0 {
                    println!(" {} {}", colored::Colorize::green("✓").bold(), dim(&format!("({} warn)", w)));
                } else {
                    println!(" {}", colored::Colorize::green("✓").bold());
                }
            }
            Err(e) => {
                errors += 1;
                println!(" {}", colored::Colorize::red("✗").bold());
                error_(&format!("  {}", e));
            }
        }
    }

    let top = args.top.as_deref()
        .or(config.build.top_entity.as_deref())
        .unwrap_or("");

    if !top.is_empty() && errors == 0 {
        step("elab", &format!("Elaborating {} ...", highlight(top)));
        match ghdl::elaborate(top, &work_dir, &args.vhdl_std) {
            Ok((_, _)) => success("elab", "Elaboration successful"),
            Err(e) => error_(&format!("Elaboration: {}", e)),
        }
    }

    if errors > 0 {
        std::process::exit(1);
    }

    Ok(())
}

use std::io::Write;
