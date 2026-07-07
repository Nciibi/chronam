use anyhow::Result;
use clap::Args;
use crate::cli::Cli;
use crate::output::{step, error_, highlight};

#[derive(Args, Debug)]
pub struct WaveArgs {
    pub vcd_path: Option<String>,

    #[arg(short = 's', long = "signals")]
    pub signals: Vec<String>,

    #[arg(short = 't', long = "time", default_value = "200")]
    pub time_ns: u64,
}

pub fn run(args: &WaveArgs, _cli: &Cli) -> Result<()> {
    let path = if let Some(p) = &args.vcd_path {
        std::path::PathBuf::from(p)
    } else {
        let config = crate::project::config::load_config(None)?;
        let work_dir = config.project.work_dir();
        let top = config.build.top_entity.unwrap_or_else(|| "top".to_string());
        work_dir.join(format!("{}.vcd", top))
    };

    if !path.exists() {
        error_(&format!("VCD file not found: {}", path.display()));
        return Ok(());
    }

    step("wave", &format!("Reading {}", highlight(&path.display().to_string())));

    match crate::vcd::parse(&path) {
        Ok(data) => {
            let diagram = crate::vcd::render_timing_diagram(&data, &args.signals, args.time_ns);
            println!("\n{}", diagram);
        }
        Err(e) => {
            error_(&format!("Failed to parse VCD: {}", e));
        }
    }

    Ok(())
}
