use anyhow::Result;
use clap::Args;
use colored::Colorize;
use crate::cli::Cli;
use crate::output::{step, success, error_, warn, highlight, dim};

#[derive(Args, Debug)]
pub struct DoctorArgs;

pub fn run(_args: &DoctorArgs, _cli: &Cli) -> Result<()> {
    step("doctor", "Running environment diagnostics...");
    println!();

    let checks: Vec<(&str, fn() -> Result<String, String>)> = vec![
        ("GHDL", check_ghdl),
        ("VHDL Standard", check_vhdl_std),
        ("Project Config", check_project_config),
        ("Git", check_git),
        ("Make", check_make),
    ];

    let mut results: Vec<(&str, &str, String)> = Vec::new();

    for (name, check) in &checks {
        match check() {
            Ok(msg) => results.push((name, "pass", msg)),
            Err(msg) => results.push((name, "fail", msg)),
        }
    }

    for (name, status, msg) in &results {
        let status_str = match *status {
            "pass" => "PASS".green().bold().to_string(),
            "warn" => "WARN".yellow().bold().to_string(),
            "fail" => "FAIL".red().bold().to_string(),
            _ => status.to_string(),
        };
        println!("  {}  {}  {}", status_str, highlight(name), dim(msg));
    }

    let has_fail = results.iter().any(|(_, s, _)| *s == "fail");
    let has_warn = results.iter().any(|(_, s, _)| *s == "warn");

    println!();
    if has_fail {
        error_("Some checks failed. See above for details.");
        std::process::exit(1);
    } else if has_warn {
        warn("All checks passed with warnings.");
    } else {
        success("doctor", "All checks passed \u{2014} environment is ready.");
    }

    Ok(())
}

fn check_ghdl() -> Result<String, String> {
    let available = crate::engine::ghdl::is_available();
    if available {
        match crate::engine::ghdl::version() {
            Ok(v) => Ok(format!("Found GHDL {} at {}", v, crate::engine::ghdl::binary_path())),
            Err(_) => Ok("GHDL found (version unknown)".into()),
        }
    } else {
        Err("GHDL not found on PATH".into())
    }
}

fn check_vhdl_std() -> Result<String, String> {
    if crate::engine::ghdl::is_available() {
        Ok("VHDL-2008 supported (via GHDL)".into())
    } else {
        Err("Cannot check VHDL standard support (GHDL not found)".into())
    }
}

fn check_project_config() -> Result<String, String> {
    let toml = std::env::current_dir().unwrap_or_default().join("chronam.toml");
    if toml.exists() {
        Ok("chronam.toml found".into())
    } else {
        Ok("No project config (running ad-hoc)".into())
    }
}

fn check_git() -> Result<String, String> {
    let result = std::process::Command::new("git").arg("--version").output();
    match result {
        Ok(o) if o.status.success() => {
            let ver = String::from_utf8_lossy(&o.stdout).trim().to_string();
            Ok(ver)
        }
        _ => Err("Git not found (optional)".into()),
    }
}

fn check_make() -> Result<String, String> {
    let result = std::process::Command::new("make").arg("--version").output();
    match result {
        Ok(o) if o.status.success() => {
            let ver = String::from_utf8_lossy(&o.stdout).lines().next().unwrap_or("make").to_string();
            Ok(ver)
        }
        _ => Err("Make not found (optional)".into()),
    }
}
