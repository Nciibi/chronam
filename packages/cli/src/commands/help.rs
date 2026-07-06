use anyhow::Result;
use clap::Args;

#[derive(Args, Debug)]
pub struct HelpArgs;

pub fn run(_args: &HelpArgs, _cli: &crate::Cli) -> Result<()> {
    use clap::CommandFactory;
    crate::Cli::command().print_help()?;
    println!();
    Ok(())
}
