use anyhow::{Result, Context, bail};
use colored::Colorize;
use std::path::Path;
use std::process::Command;

#[derive(Debug)]
pub struct Issue {
    pub severity: String,
    pub line: u32,
    pub col: u32,
    pub message: String,
}

pub fn is_available() -> bool {
    binary_path_impl().is_some()
}

pub fn binary_path() -> String {
    binary_path_impl().unwrap_or_else(|| "ghdl".into())
}

fn binary_path_impl() -> Option<String> {
    std::env::var("GHDL_PATH").ok().or_else(|| {
        let result = if cfg!(target_os = "windows") {
            Command::new("where").arg("ghdl").output()
        } else {
            Command::new("which").arg("ghdl").output()
        };
        match result {
            Ok(output) if output.status.success() => {
                String::from_utf8(output.stdout).ok()
                    .map(|s| s.trim().to_string())
            }
            _ => None,
        }
    }).or_else(|| {
        let candidates = if cfg!(target_os = "windows") {
            vec![r"C:\ghdl\bin\ghdl.exe", r"D:\ghdl\bin\ghdl.exe"]
        } else {
            vec!["/usr/local/bin/ghdl", "/usr/bin/ghdl"]
        };
        candidates.into_iter().find(|p| Path::new(p).exists()).map(|s| s.to_string())
    })
}

pub fn version() -> Result<String> {
    let output = Command::new(binary_path())
        .arg("--version")
        .output()
        .context("Failed to run ghdl --version")?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let version = stdout.lines().next().unwrap_or("unknown").to_string();
    Ok(version)
}

fn ghdl_std(vhdl_std: &str) -> &str {
    match vhdl_std {
        "87" | "1987" => "87",
        "93" | "1993" => "93",
        "02" | "2002" => "02",
        "08" | "2008" => "08",
        "19" | "2019" => "19",
        _ => vhdl_std,
    }
}

pub fn analyze(source: &Path, work_dir: &Path, vhdl_std: &str) -> Result<(u32, u32)> {
    let std_flag = format!("--std={}", ghdl_std(vhdl_std));
    let output = Command::new(binary_path())
        .args(["-a", &std_flag, "--workdir=."])
        .arg(source)
        .current_dir(work_dir)
        .output()
        .with_context(|| format!("Failed to analyze {}", source.display()))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let err_lines: Vec<&str> = stderr.lines().filter(|l| !l.is_empty()).collect();
        let msg = err_lines.first().unwrap_or(&"analysis failed").to_string();
        bail!("{}", msg);
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    let error_count = stderr.lines().filter(|l| l.contains("error:") || l.contains("Error:")).count() as u32;
    let warning_count = stderr.lines().filter(|l| l.contains("warning:") || l.contains("Warning:")).count() as u32;
    Ok((error_count, warning_count))
}

pub fn analyze_syntax(source: &Path, work_dir: &Path, vhdl_std: &str) -> Result<Vec<Issue>> {
    let std_flag = format!("--std={}", vhdl_std);
    let output = Command::new(binary_path())
        .args(["-a", &std_flag, "--workdir=.", "--syntax-only"])
        .arg(source)
        .current_dir(work_dir)
        .output()
        .context("Syntax analysis failed")?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    let mut issues = Vec::new();
    for line in stderr.lines() {
        if let Some(parsed) = parse_ghdl_error(line) {
            issues.push(Issue {
                severity: parsed.severity,
                line: parsed.line,
                col: parsed.col,
                message: parsed.message,
            });
        }
    }
    Ok(issues)
}

pub fn elaborate(entity: &str, work_dir: &Path, vhdl_std: &str) -> Result<(u32, u32)> {
    let std_flag = format!("--std={}", vhdl_std);
    let output = Command::new(binary_path())
        .args(["-e", &std_flag, "--workdir=.", entity])
        .current_dir(work_dir)
        .output()
        .with_context(|| format!("Failed to elaborate {}", entity))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let msg = stderr.lines().next().unwrap_or("elaboration failed").to_string();
        bail!("{}", msg);
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    let errors = stderr.lines().filter(|l| l.contains("error:")).count() as u32;
    let warnings = stderr.lines().filter(|l| l.contains("warning:")).count() as u32;
    Ok((errors, warnings))
}

pub fn run(entity: &str, work_dir: &Path, vhdl_std: &str, duration_ns: u64, wave_format: &str) -> Result<Option<String>> {
    let std_flag = format!("--std={}", vhdl_std);
    let stop_time = format!("--stop-time={}ns", duration_ns);
    let vcd_path = work_dir.join(format!("{}.vcd", entity));
    let vcd_flag = format!("--vcd={}", vcd_path.display());

    let mut args = vec!["-r", &std_flag, "--workdir=.", entity, &stop_time];
    if wave_format == "vcd" {
        args.push(&vcd_flag);
    }

    let output = Command::new(binary_path())
        .args(&args)
        .current_dir(work_dir)
        .output()
        .with_context(|| format!("Failed to run simulation for {}", entity))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let msg = stderr.lines().next().unwrap_or("simulation failed").to_string();
        bail!("{}", msg);
    }

    if vcd_path.exists() {
        Ok(Some(vcd_path.display().to_string()))
    } else {
        Ok(None)
    }
}

pub fn clean(work_dir: &Path) -> Result<()> {
    if !work_dir.exists() { return Ok(()); }
    let mut count = 0u64;
    if let Ok(entries) = std::fs::read_dir(work_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                if matches!(ext, "o" | "cf" | "vcd" | "ghw") {
                    std::fs::remove_file(&path)?;
                    count += 1;
                }
            }
        }
    }
    if count > 0 {
        eprintln!("  {} Cleaned {} artifact(s)", "[chronam]".dimmed(), count);
    }
    Ok(())
}

struct ParsedError {
    _file: String,
    line: u32,
    col: u32,
    severity: String,
    message: String,
}

fn parse_ghdl_error(line: &str) -> Option<ParsedError> {
    let re = regex_lite::Regex::new(r"^(.+?):(\d+):(\d+):\s*(error|warning|note):\s*(.+)$").ok()?;
    let caps = re.captures(line)?;
    Some(ParsedError {
        _file: caps[1].to_string(),
        line: caps[2].parse().unwrap_or(0),
        col: caps[3].parse().unwrap_or(0),
        severity: caps[4].to_string(),
        message: caps[5].to_string(),
    })
}
