mod app;
mod cli;
mod commands;
mod engine;
mod output;
mod project;
mod theme;
mod timeline;
mod tui;
mod vcd;
mod wave;

use anyhow::Result;

fn main() -> Result<()> {
    let cli = <cli::Cli as clap::Parser>::parse();
    cli.run()
}
 