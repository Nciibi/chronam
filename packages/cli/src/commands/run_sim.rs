use anyhow::{Context, Result};
use std::fs;
use std::path::Path;
use crate::cli::Cli;
use crate::output::{error_, highlight, step, success};

pub fn run(tb_path: &str, _cli: &Cli) -> Result<()> {
    let path = Path::new(tb_path);
    if !path.exists() {
        error_(&format!("Testbench file not found: {}", tb_path));
        return Ok(());
    }

    let content = fs::read_to_string(path)
        .with_context(|| format!("Failed to read {}", tb_path))?;

    let entity = match extract_tb_entity(&content) {
        Some(e) => e,
        None => {
            error_("Could not find the testbench entity name in the file");
            return Ok(());
        }
    };

    if !crate::engine::ghdl::is_available() {
        error_("GHDL not found. Install GHDL or add it to your PATH.");
        return Ok(());
    }

    step("sim", &format!("Testbench entity: {}", highlight(&entity)));

    // Use the parent directory of the testbench as the work directory
    let work_dir = path.parent().unwrap_or(Path::new("."));
    let abs_work = std::path::absolute(work_dir)
        .unwrap_or_else(|_| work_dir.to_path_buf());

    // Gather VHDL source files in the same directory (non-recursive)
    let mut sources: Vec<std::path::PathBuf> = Vec::new();
    if let Ok(entries) = fs::read_dir(work_dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("");
                if ext == "vhd" || ext == "vhdl" {
                    sources.push(p);
                }
            }
        }
    }
    sources.sort();

    if sources.is_empty() {
        error_(&format!("No .vhd/.vhdl files found in {}", work_dir.display()));
        return Ok(());
    }

    step("sim", &format!("Analyzing {} source file{} in {} ...",
        sources.len(),
        if sources.len() == 1 { "" } else { "s" },
        highlight(&work_dir.display().to_string()),
    ));

    let vhdl_std = "93";

    for source in &sources {
        let name = source.file_name().unwrap_or_default().to_string_lossy();
        match crate::engine::ghdl::analyze(source, &abs_work, vhdl_std) {
            Ok((errs, warns)) => {
                if errs > 0 {
                    error_(&format!("Analysis of {} failed ({} errors)", name, errs));
                    return Ok(());
                }
                if warns > 0 {
                    println!("  {} analyzed with {} warnings", name, warns);
                } else {
                    println!("  {} ok", name);
                }
            }
            Err(e) => {
                error_(&format!("Analysis of {} failed: {}", name, e));
                return Ok(());
            }
        }
    }

    step("sim", &format!("Elaborating {} ...", highlight(&entity)));
    match crate::engine::ghdl::elaborate(&entity, &abs_work, vhdl_std) {
        Ok((_, _)) => {}
        Err(e) => {
            error_(&format!("Elaboration failed: {}", e));
            return Ok(());
        }
    }

    step("sim", "Running simulation...");

    let duration_ns = 1_000_000;
    let vcd_path = match crate::engine::ghdl::run(&entity, &abs_work, vhdl_std, duration_ns, "vcd") {
        Ok(path) => {
            success("sim", &format!("Simulation complete ({}ns)", duration_ns));
            path
        }
        Err(e) => {
            error_(&format!("Simulation failed: {}", e));
            return Ok(());
        }
    };

    let vcd_path = match vcd_path {
        Some(p) => p,
        None => {
            error_("No VCD file produced by simulation");
            return Ok(());
        }
    };

    step("tui", &format!("Loading waveform from {}", highlight(&vcd_path)));

    match crate::vcd::parse(Path::new(&vcd_path)) {
        Ok(data) => {
            success("tui", "Opening waveform viewer (press q to quit)");
            println!();
            crate::tui::run_interactive(&data)?;
        }
        Err(e) => {
            error_(&format!("Failed to parse VCD: {}", e));
        }
    }

    Ok(())
}

fn extract_tb_entity(content: &str) -> Option<String> {
    let re = regex_lite::Regex::new(
        r"(?is)\bentity\s+(\w+)\s+is\b"
    ).ok()?;
    re.captures(content).map(|c| c[1].to_string())
}
