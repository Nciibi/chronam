use anyhow::Result;
use clap::Args;
use crate::Cli;
use crate::output::{step, success, warn, dim};

#[derive(Args, Debug)]
pub struct CleanArgs {
    /// Also remove the VCD waveform files
    #[arg(long = "all")]
    pub all: bool,
}

pub fn run(args: &CleanArgs, cli: &Cli) -> Result<()> {
    let config = crate::project::config::load_config(cli.project.as_deref())?;
    let work_dir = config.project.work_dir();

    step("clean", "Cleaning build artifacts...");

    if !work_dir.exists() {
        warn("No build directory found — nothing to clean.");
        return Ok(());
    }

    let mut count = 0u64;
    if let Ok(entries) = std::fs::read_dir(&work_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                match ext {
                    "o" | "cf" => {
                        std::fs::remove_file(&path)?;
                        count += 1;
                    }
                    "vcd" | "ghw" if args.all => {
                        std::fs::remove_file(&path)?;
                        count += 1;
                    }
                    _ => {}
                }
            }
        }
    }

    success("clean", &format!("Removed {} artifact(s) from {}", count, dim(&work_dir.display().to_string())));
    Ok(())
}
