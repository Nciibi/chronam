mod cli;
mod commands;
mod engine;
mod output;
mod project;

use anyhow::Result;
use clap::CommandFactory;
use cli::Cli;

fn main() -> Result<()> {
    let cli = <Cli as clap::Parser>::parse();
    cli.run()
}

#[cfg(test)]
mod tests {
    use clap::CommandFactory;
    use crate::cli::Cli;

    #[test]
    fn verify_cli() {
        Cli::command().debug_assert();
    }
}
