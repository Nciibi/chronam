use anyhow::Result;
use clap::Args;
use crate::Cli;
use crate::output::{step, success, error_, warn, highlight, dim};

#[derive(Args, Debug)]
pub struct TestArgs {
    /// Specific test entity to run
    pub entity: Option<String>,

    /// Test duration in nanoseconds
    #[arg(short = 'd', long = "duration", default_value = "1000")]
    pub duration_ns: u64,

    /// VHDL standard
    #[arg(short = 's', long = "std", default_value = "2008")]
    pub vhdl_std: String,

    /// Verbose test output
    #[arg(short = 'v', long = "verbose")]
    pub verbose: bool,
}

pub fn run(args: &TestArgs, cli: &Cli) -> Result<()> {
    let config = crate::project::config::load_config(cli.project.as_deref())?;
    let sources = crate::project::config::resolve_sources(&config.build.sources)?;

    // Find testbench files (tb_* or *_tb)
    let testbenches: Vec<_> = sources.iter()
        .filter(|s| {
            let name = s.file_stem().and_then(|n| n.to_str()).unwrap_or("");
            name.starts_with("tb_") || name.ends_with("_tb")
        })
        .collect();

    if testbenches.is_empty() && args.entity.is_none() {
        warn("No testbench files found (looking for tb_*.vhd or *_tb.vhd)");
        return Ok(());
    }

    let entities: Vec<&str> = if let Some(ref entity) = args.entity {
        vec![entity.as_str()]
    } else {
        testbenches.iter().filter_map(|s| s.file_stem().and_then(|n| n.to_str())).collect()
    };

    step("test", &format!("Running {} test(s)...", entities.len()));

    let work_dir = config.project.work_dir();

    // Analyze all sources
    for source in &sources {
        crate::engine::ghdl::analyze(source, &work_dir, &args.vhdl_std)?;
    }

    let mut passed = 0;
    let mut failed = 0;

    for entity in &entities {
        print!("  {} ... ", highlight(entity));
        std::io::stdout().flush()?;

        match crate::engine::ghdl::elaborate(entity, &work_dir, &args.vhdl_std) {
            Ok((_, _)) => {
                match crate::engine::ghdl::run(entity, &work_dir, &args.vhdl_std, args.duration_ns, "vcd") {
                    Ok(_) => {
                        println!("{}", colored::Colorize::green("PASS").bold());
                        passed += 1;
                    }
                    Err(e) => {
                        println!("{}", colored::Colorize::red("FAIL").bold());
                        if args.verbose { error_(&format!("  {}", e)); }
                        failed += 1;
                    }
                }
            }
            Err(e) => {
                println!("{} {}", colored::Colorize::red("FAIL").bold(), dim(&format!("({})", e)));
                failed += 1;
            }
        }
    }

    println!();
    if failed > 0 {
        error_(&format!("{}/{} test(s) failed", failed, entities.len()));
        std::process::exit(1);
    } else {
        success("test", &format!("All {}/{} test(s) passed", passed, entities.len()));
    }

    Ok(())
}

use std::io::Write;
