use anyhow::Result;
use clap::Args;
use comfy_table::{Table, Cell, Color as TableColor};
use crate::cli::Cli;
use crate::output::{step, highlight, dim};

#[derive(Args, Debug)]
pub struct InfoArgs;

pub fn run(_args: &InfoArgs, cli: &Cli) -> Result<()> {
    let config = crate::project::config::load_config(cli.project.as_deref())?;

    step("info", "Project Information");
    println!();

    let mut table = Table::new();
    table.load_preset(comfy_table::presets::NOTHING);
    table.set_header(vec![
        Cell::new("Property").fg(TableColor::DarkGrey),
        Cell::new("Value").fg(TableColor::DarkGrey),
    ]);

    table.add_row(vec![
        Cell::new("Name"),
        Cell::new(&config.project.name),
    ]);
    table.add_row(vec![
        Cell::new("Version"),
        Cell::new(&config.project.version),
    ]);
    table.add_row(vec![
        Cell::new("VHDL Standard"),
        Cell::new(&config.build.vhdl_std),
    ]);
    table.add_row(vec![
        Cell::new("Top Entity"),
        Cell::new(config.build.top_entity.as_deref().unwrap_or("(not set)")),
    ]);
    table.add_row(vec![
        Cell::new("Source Patterns"),
        Cell::new(&format!("{} pattern(s)", config.build.sources.len())),
    ]);
    table.add_row(vec![
        Cell::new("Work Directory"),
        Cell::new(config.project.work_dir().display().to_string()),
    ]);
    table.add_row(vec![
        Cell::new("Sim Duration"),
        Cell::new(&format!("{} ns", config.simulation.duration_ns)),
    ]);
    table.add_row(vec![
        Cell::new("Wave Format"),
        Cell::new(&config.simulation.wave_format),
    ]);

    println!("{}", table);
    println!();

    let sources = crate::project::config::resolve_sources(&config.build.sources, config.config_dir.as_ref())?;
    println!("  {} {} {} source file(s) found", dim("·"), highlight(&sources.len().to_string()), dim("matching patterns"));

    Ok(())
}
