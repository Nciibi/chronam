mod cli;
mod commands;
mod engine;
mod output;
mod project;
mod tui;
mod vcd;

use anyhow::Result;

fn main() -> Result<()> {
    let cli = <cli::Cli as clap::Parser>::parse();
    cli.run()
}
