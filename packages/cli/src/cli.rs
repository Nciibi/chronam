use anyhow::Result;
use clap::{Parser, Subcommand};
use clap::CommandFactory;



#[derive(clap::Args, Debug)]
pub struct HelpArgs;

#[derive(Parser, Debug)]
#[command(
    name = "chronam",
    about = "Modern VHDL development toolkit",
    long_about = "Chronam — a modern VHDL development toolkit for FPGA engineers.\n\nA professional CLI for compiling, simulating, and analyzing VHDL designs.\nPowered by GHDL, designed for engineers.",
    version,
    propagate_version = true,
    args_conflicts_with_subcommands = false,
    disable_help_subcommand = true,
    styles = cli_styles(),
)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,

    #[arg(short = 'v', long = "verbose", global = true, help = "Enable verbose output")]
    pub verbose: bool,

    #[arg(short = 'p', long = "project", global = true, help = "Path to chronam.toml project file")]
    pub project: Option<String>,
}

#[derive(Debug, Subcommand)]
pub enum Commands {
    #[command(aliases = &["n", "create"])]
    New(crate::commands::new::NewArgs),

    #[command(aliases = &["b", "make"])]
    Build(crate::commands::build::BuildArgs),

    #[command(aliases = &["sim", "run"])]
    Simulate(crate::commands::simulate::SimulateArgs),

    #[command(aliases = &["l", "check"])]
    Lint(crate::commands::lint::LintArgs),

    #[command(aliases = &["c", "cl"])]
    Clean(crate::commands::clean::CleanArgs),

    #[command(aliases = &["diag", "checkup"])]
    Doctor(crate::commands::doctor::DoctorArgs),

    #[command(aliases = &["comp"])]
    Compile(crate::commands::compile::CompileArgs),

    #[command(aliases = &["w", "monitor"])]
    Watch(crate::commands::watch::WatchArgs),

    #[command(aliases = &["t", "testv"])]
    Test(crate::commands::test::TestArgs),

    #[command(aliases = &["completions"])]
    Completion(crate::commands::completion::CompletionArgs),

    #[command(aliases = &["vw", "view"])]
    Wave(crate::commands::wave::WaveArgs),

    Info(crate::commands::info::InfoArgs),

    #[command(aliases = &["h", "?"])]
    Help(HelpArgs),
}

impl Cli {
    pub fn run(&self) -> Result<()> {
        use crate::commands::*;
        match &self.command {
            Commands::New(args) => new::run(args, self),
            Commands::Build(args) => build::run(args, self),
            Commands::Simulate(args) => simulate::run(args, self),
            Commands::Lint(args) => lint::run(args, self),
            Commands::Clean(args) => clean::run(args, self),
            Commands::Doctor(args) => doctor::run(args, self),
            Commands::Compile(args) => compile::run(args, self),
            Commands::Watch(args) => watch::run(args, self),
            Commands::Test(args) => test::run(args, self),
            Commands::Completion(args) => completion::run(args, self),
            Commands::Wave(args) => wave::run(args, self),
            Commands::Info(args) => info::run(args, self),
            Commands::Help(_) => {
                <Cli as CommandFactory>::command().print_help()?;
                println!();
                Ok(())
            }
        }
    }
}

pub fn cli_styles() -> clap::builder::Styles {
    use clap::builder::styling::{AnsiColor, Style};
    clap::builder::Styles::styled()
        .header(Style::new().bold().fg_color(Some(AnsiColor::Cyan.into())))
        .usage(Style::new().bold().fg_color(Some(AnsiColor::Cyan.into())))
        .literal(Style::new().fg_color(Some(AnsiColor::Green.into())))
        .placeholder(Style::new().fg_color(Some(AnsiColor::BrightYellow.into())))
        .error(Style::new().bold().fg_color(Some(AnsiColor::Red.into())))
        .valid(Style::new().bold().fg_color(Some(AnsiColor::Green.into())))
        .invalid(Style::new().bold().fg_color(Some(AnsiColor::Yellow.into())))
}
