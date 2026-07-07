use anyhow::Result;
use clap::Args;
use colored::Colorize;
use std::io::Write;
use crate::cli::Cli;
use crate::output::{step, success, error_, highlight, dim};

#[derive(Args, Debug)]
pub struct CompileArgs {
    pub files: Vec<String>,
    #[arg(short = 't', long = "top")]
    pub top: Option<String>,
    #[arg(short = 's', long = "std", default_value = "2008")]
    pub vhdl_std: String,
    #[arg(short = 'f', long = "force")]
    pub force: bool,
    #[arg(short = 'j', long = "jobs", default_value = "1")]
    pub jobs: u32,
}

pub fn run(args: &CompileArgs, cli: &Cli) -> Result<()> {
    let config = crate::project::config::load_config(cli.project.as_deref())?;
    let sources = if args.files.is_empty() {
        crate::project::config::resolve_sources(&config.build.sources, config.config_dir.as_ref())?
    } else {
        args.files.iter().map(std::path::PathBuf::from).collect()
    };

    step("comp", &format!("Compiling {} file(s)...", sources.len()));

    if !crate::engine::ghdl::is_available() {
        error_("GHDL not found. Install GHDL or add it to your PATH.");
        return Ok(());
    }

    let work_dir = config.project.work_dir();
    if args.force {
        crate::engine::ghdl::clean(&work_dir)?;
    }

    let mut errors = 0;
    for source in &sources {
        let name = source.file_name().unwrap_or_default().to_string_lossy();
        print!("  {} ", highlight(&name));
        std::io::stdout().flush()?;

        match crate::engine::ghdl::analyze(source, &work_dir, &args.vhdl_std) {
            Ok((e, w)) => {
                errors += e;
                if e > 0 {
                    println!(" {}", "✗".red().bold());
                } else if w > 0 {
                    println!(" {} {}", "✓".green().bold(), dim(&format!("({} warn)", w)));
                } else {
                    println!(" {}", "✓".green().bold());
                }
            }
            Err(e) => {
                errors += 1;
                println!(" {}", "✗".red().bold());
                error_(&format!("  {}", e));
            }
        }
    }

    let top = args.top.as_deref()
        .or(config.build.top_entity.as_deref())
        .unwrap_or("");

    if !top.is_empty() && errors == 0 {
        step("elab", &format!("Elaborating {} ...", highlight(top)));
        match crate::engine::ghdl::elaborate(top, &work_dir, &args.vhdl_std) {
            Ok((_, _)) => success("elab", "Elaboration successful"),
            Err(e) => error_(&format!("Elaboration: {}", e)),
        }
    }

    if errors > 0 {
        std::process::exit(1);
    }
    Ok(())
}
