use anyhow::Result;
use clap::Args;
use colored::Colorize;
use crate::cli::Cli;
use crate::output::{step, error_, highlight, dim};

#[derive(Args, Debug)]
pub struct LintArgs {
    pub files: Vec<String>,
    #[arg(short = 's', long = "std", default_value = "2008")]
    pub vhdl_std: String,
}

pub fn run(args: &LintArgs, cli: &Cli) -> Result<()> {
    let config = crate::project::config::load_config(cli.project.as_deref())?;
    let sources = if args.files.is_empty() {
        crate::project::config::resolve_sources(&config.build.sources, config.config_dir.as_ref())?
    } else {
        args.files.iter().map(std::path::PathBuf::from).collect()
    };

    step("lint", &format!("Analyzing {} file(s)...", sources.len()));
    let work_dir = config.project.work_dir();
    let mut has_errors = false;

    for source in &sources {
        let name = source.file_name().unwrap_or_default().to_string_lossy();
        match crate::engine::ghdl::analyze_syntax(source, &work_dir, &args.vhdl_std) {
            Ok(issues) => {
                if issues.is_empty() {
                    println!("  {} {}  {}", dim("✓"), highlight(&name), dim("clean"));
                } else {
                    has_errors = true;
                    println!("  {} {}  {}", dim("✗"), highlight(&name), dim(&format!("{} issue(s)", issues.len())));
                    for issue in &issues {
                        let icon = if issue.severity == "error" { "error".red() } else { "warn".yellow() };
                        println!("    {}:{}:{} {} {}", dim(&source.display().to_string()), issue.line, issue.col, icon, issue.message);
                    }
                }
            }
            Err(e) => {
                has_errors = true;
                error_(&format!("{}: {}", name, e));
            }
        }
    }

    if has_errors {
        std::process::exit(1);
    } else {
        step("lint", "All files pass linting");
    }
    Ok(())
}
