use anyhow::Result;
use clap::Args;
use crate::cli::Cli;
use crate::output::{step, success, warn, dim};

#[derive(Args, Debug)]
pub struct CleanArgs;

pub fn run(_args: &CleanArgs, cli: &Cli) -> Result<()> {
    let config = crate::project::config::load_config(cli.project.as_deref())?;
    let work_dir = config.project.work_dir();

    step("clean", "Cleaning build artifacts...");

    if !work_dir.exists() {
        warn("No build directory found \u{2014} nothing to clean.");
        return Ok(());
    }

    let count = crate::engine::ghdl::clean(&work_dir)?;

    success("clean", &format!("Removed {} artifact(s) from {}", count, dim(&work_dir.display().to_string())));
    Ok(())
}
