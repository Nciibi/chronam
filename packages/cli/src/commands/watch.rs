use anyhow::Result;
use clap::Args;
use std::time::Duration;
use crate::Cli;
use crate::output::{step, success, warn, highlight, dim};

#[derive(Args, Debug)]
pub struct WatchArgs {
    /// Debounce interval in milliseconds
    #[arg(short = 'd', long = "debounce", default_value = "200")]
    pub debounce_ms: u64,

    /// Command to run on changes (default: build)
    pub command: Vec<String>,
}

pub fn run(args: &WatchArgs, cli: &Cli) -> Result<()> {
    let config = crate::project::config::load_config(cli.project.as_deref())?;
    let sources = crate::project::config::resolve_sources(&config.build.sources)?;

    let dirs: Vec<_> = sources.iter()
        .filter_map(|s| s.parent())
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();

    step("watch", &format!("Watching {} director(ies) for changes...", dirs.len()));
    println!("  {} {} | {} {} | {} {}",
        dim("debounce:"), highlight(&format!("{}ms", args.debounce_ms)),
        dim("sources:"), highlight(&format!("{}", sources.len())),
        dim("press"), highlight("Ctrl+C"), dim("to stop"),
    );
    println!();

    // Simple polling-based file watcher
    let mut last_mtimes: std::collections::HashMap<std::path::PathBuf, std::time::SystemTime> = std::collections::HashMap::new();

    loop {
        let mut changed = false;
        for source in &sources {
            if let Ok(meta) = source.metadata() {
                if let Ok(mtime) = meta.modified() {
                    let prev = last_mtimes.insert(source.clone(), mtime);
                    if prev.map_or(true, |p| p != mtime) {
                        changed = true;
                    }
                }
            }
        }

        if changed {
            success("watch", "Change detected, rebuilding...");
            let build_args = crate::commands::build::BuildArgs {
                files: vec![],
                force: false,
                jobs: 1,
            };
            if let Err(e) = super::build::run(&build_args, cli) {
                warn(&format!("Build error: {}", e));
            }
            println!();
            step("watch", "Watching for changes...");
        }

        std::thread::sleep(Duration::from_millis(args.debounce_ms));
    }
}
