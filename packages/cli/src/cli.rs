use anyhow::Result;
use clap::{Parser, Subcommand, command};

use crate::commands;

#[derive(Parser, Debug)]
#[command(
    name = "chronam",
    about = "Modern VHDL development toolkit",
    long_about = "Chronam — a modern VHDL development toolkit for FPGA engineers.\n\nA professional CLI for compiling, simulating, and analyzing VHDL designs.\nPowered by GHDL, designed for engineers.",
    version,
    propagate_version = true,
    args_conflicts_with_subcommands = false,
    styles = cli_styles(),
)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,

    /// Enable verbose output
    #[arg(short = 'v', long = "verbose", global = true, help = "Enable verbose output")]
    pub verbose: bool,

    /// Path to chronam.toml project file
    #[arg(short = 'p', long = "project", global = true, help = "Path to chronam.toml project file")]
    pub project: Option<String>,
}

#[derive(Debug, Subcommand)]
pub enum Commands {
    /// Create a new VHDL project
    #[command(aliases = &["n", "create"])]
    New(new::NewArgs),

    /// Build the current project
    #[command(aliases = &["b", "make"])]
    Build(build::BuildArgs),

    /// Run simulation
    #[command(aliases = &["sim", "run"])]
    Simulate(simulate::SimulateArgs),

    /// Analyze and lint VHDL sources
    #[command(aliases = &["l", "check"])]
    Lint(lint::LintArgs),

    /// Clean build artifacts
    #[command(aliases = &["c", "cl"])]
    Clean(clean::CleanArgs),

    /// Run diagnostics on the environment
    #[command(aliases = &["diag", "checkup"])]
    Doctor(doctor::DoctorArgs),

    /// Compile the design without simulation
    #[command(aliases = &["comp"])]
    Compile(compile::CompileArgs),

    /// Watch project and auto-rebuild on changes
    #[command(aliases = &["w", "monitor"])]
    Watch(watch::WatchArgs),

    /// Run tests
    #[command(aliases = &["t", "testv"])]
    Test(test::TestArgs),

    /// Generate shell completions
    #[command(aliases = &["completions"])]
    Completion(completion::CompletionArgs),

    /// Show information about the current project
    Info(info::InfoArgs),

    /// Print this help message
    #[command(aliases = &["h", "?"])]
    Help(help::HelpArgs),
}

impl Cli {
    pub fn run(&self) -> Result<()> {
        match &self.command {
            Commands::New(args) => commands::new::run(args, self),
            Commands::Build(args) => commands::build::run(args, self),
            Commands::Simulate(args) => commands::simulate::run(args, self),
            Commands::Lint(args) => commands::lint::run(args, self),
            Commands::Clean(args) => commands::clean::run(args, self),
            Commands::Doctor(args) => commands::doctor::run(args, self),
            Commands::Compile(args) => commands::compile::run(args, self),
            Commands::Watch(args) => commands::watch::run(args, self),
            Commands::Test(args) => commands::test::run(args, self),
            Commands::Completion(args) => commands::completion::run(args, self),
            Commands::Info(args) => commands::info::run(args, self),
            Commands::Help(_) => {
                use clap::CommandFactory;
                <Cli as clap::Parser>::command().print_help()?;
                println!();
                Ok(())
            }
        }
    }
}

pub fn cli_styles() -> clap::builder::Styles {
    use clap::builder::styling::{AnsiColor, Effects, Style};
    clap::builder::Styles::styled()
        .header(Style::new().bold().fg_color(Some(AnsiColor::Cyan.into())))
        .usage(Style::new().bold().fg_color(Some(AnsiColor::Cyan.into())))
        .literal(Style::new().fg_color(Some(AnsiColor::Green.into())))
        .placeholder(Style::new().fg_color(Some(AnsiColor::BrightYellow.into())))
        .error(Style::new().bold().fg_color(Some(AnsiColor::Red.into())))
        .valid(Style::new().bold().fg_color(Some(AnsiColor::Green.into())))
        .invalid(Style::new().bold().fg_color(Some(AnsiColor::Yellow.into())))
}
