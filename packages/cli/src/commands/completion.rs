use anyhow::Result;
use clap::CommandFactory;
use clap_complete::Shell;
use std::io;
use crate::cli::Cli;
use crate::output::{step, success, error_, highlight, dim};

#[derive(clap::Args, Debug)]
pub struct CompletionArgs {
    pub shell: Option<String>,
}

pub fn run(args: &CompletionArgs, _cli: &Cli) -> Result<()> {
    let shell_name = args.shell.as_deref().unwrap_or("bash");
    let shell = match shell_name {
        "bash" => Shell::Bash,
        "zsh" => Shell::Zsh,
        "fish" => Shell::Fish,
        "powershell" | "pwsh" => Shell::PowerShell,
        "elvish" => Shell::Elvish,
        _ => {
            error_(&format!("Unsupported shell '{}'. Supported: bash, zsh, fish, powershell, elvish", shell_name));
            std::process::exit(1);
        }
    };

    let mut cmd = <Cli as CommandFactory>::command();
    let name = cmd.get_name().to_string();

    step("completion", &format!("Generating {} completion script...", highlight(shell_name)));

    clap_complete::generate(shell, &mut cmd, &name, &mut io::stdout());

    success("done", &format!("{} completion script generated", highlight(shell_name)));
    println!();
    let install_hint = match shell_name {
        "bash" => "source <(chronam completion bash)",
        "zsh" => "chronam completion zsh > /usr/local/share/zsh/site-functions/_chronam",
        "fish" => "chronam completion fish > ~/.config/fish/completions/chronam.fish",
        "powershell" => "chronam completion powershell | Out-String | Invoke-Expression",
        _ => "",
    };
    if !install_hint.is_empty() {
        println!("  {} {}", dim("Install with:"), dim(install_hint));
    }
    Ok(())
}
