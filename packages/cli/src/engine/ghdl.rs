use anyhow::{Result, Context, bail};
use std::fs;
use std::path::Path;
use std::process::Command;
use std::sync::OnceLock;

#[derive(Debug)]
pub struct Issue {
    pub severity: String,
    pub line: u32,
    pub col: u32,
    pub message: String,
}

fn ghdl_error_re() -> &'static regex_lite::Regex {
    static RE: OnceLock<regex_lite::Regex> = OnceLock::new();
    RE.get_or_init(|| regex_lite::Regex::new(r"^(.+?):(\d+):(\d+):\s*(error|warning|note):\s*(.+)$").unwrap())
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
        other => {
            eprintln!("warn: unknown VHDL standard '{}', passing through to GHDL", other);
            other
        }
    }
}

fn stderr_first_line(stderr: &[u8]) -> String {
    let s = String::from_utf8_lossy(stderr);
    s.lines().find(|l| !l.is_empty()).unwrap_or("(empty stderr)").to_string()
}

pub fn analyze(source: &Path, work_dir: &Path, vhdl_std: &str) -> Result<(u32, u32)> {
    let std_flag = format!("--std={}", ghdl_std(vhdl_std));
    let abs_source = std::path::absolute(source)
        .unwrap_or_else(|_| source.to_path_buf());
    fs::create_dir_all(work_dir).ok();
    let output = Command::new(binary_path())
        .args(["-a", &std_flag, "--workdir=.", &abs_source.to_string_lossy()])
        .current_dir(work_dir)
        .output()
        .with_context(|| format!("Failed to run GHDL analyze on {}", source.display()))?;

    if !output.status.success() {
        let msg = stderr_first_line(&output.stderr);
        bail!("{}", msg);
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    let error_count = stderr.lines().filter(|l| l.contains("error:") || l.contains("Error:")).count() as u32;
    let warning_count = stderr.lines().filter(|l| l.contains("warning:") || l.contains("Warning:")).count() as u32;
    Ok((error_count, warning_count))
}

pub fn analyze_syntax(source: &Path, work_dir: &Path, vhdl_std: &str) -> Result<Vec<Issue>> {
    let std_flag = format!("--std={}", ghdl_std(vhdl_std));
    let abs_source = std::path::absolute(source)
        .unwrap_or_else(|_| source.to_path_buf());
    fs::create_dir_all(work_dir).ok();
    let output = Command::new(binary_path())
        .args(["-a", &std_flag, "--workdir=.", &abs_source.to_string_lossy()])
        .current_dir(work_dir)
        .output()
        .with_context(|| format!("Failed to run GHDL syntax check on {}", source.display()))?;

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
    let std_flag = format!("--std={}", ghdl_std(vhdl_std));
    fs::create_dir_all(work_dir).ok();
    let output = Command::new(binary_path())
        .args(["-e", &std_flag, "--workdir=.", entity])
        .current_dir(work_dir)
        .output()
        .with_context(|| format!("Failed to run GHDL elaborate on {}", entity))?;

    if !output.status.success() {
        let msg = stderr_first_line(&output.stderr);
        bail!("{}", msg);
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    let errors = stderr.lines().filter(|l| l.contains("error:")).count() as u32;
    let warnings = stderr.lines().filter(|l| l.contains("warning:")).count() as u32;
    Ok((errors, warnings))
}

pub fn run(entity: &str, work_dir: &Path, vhdl_std: &str, duration_ns: u64, wave_format: &str) -> Result<Option<String>> {
    let std_flag = format!("--std={}", ghdl_std(vhdl_std));
    let stop_time = format!("--stop-time={}ns", duration_ns);
    let abs_work = std::path::absolute(work_dir)
        .unwrap_or_else(|_| work_dir.to_path_buf());

    let mut args = vec!["-r", &std_flag, "--workdir=.", entity, &stop_time];
    let wave_path;
    let wave_flag;

    match wave_format {
        "vcd" => {
            wave_path = abs_work.join(format!("{}.vcd", entity));
            wave_flag = format!("--vcd={}", wave_path.display());
            args.push(&wave_flag);
        }
        "ghw" => {
            wave_path = abs_work.join(format!("{}.ghw", entity));
            wave_flag = format!("--wave={}", wave_path.display());
            args.push(&wave_flag);
        }
        "fst" => {
            wave_path = abs_work.join(format!("{}.fst", entity));
            wave_flag = format!("--fst={}", wave_path.display());
            args.push(&wave_flag);
        }
        _ => {
            wave_path = abs_work.join(format!("{}.vcd", entity));
        }
    }

    fs::create_dir_all(work_dir).ok();
    let output = Command::new(binary_path())
        .args(&args)
        .current_dir(work_dir)
        .output()
        .with_context(|| format!("Failed to run simulation for {}", entity))?;

    if !output.status.success() {
        let msg = stderr_first_line(&output.stderr);
        bail!("{}", msg);
    }

    if wave_path.exists() {
        Ok(Some(wave_path.display().to_string()))
    } else {
        Ok(None)
    }
}

pub fn clean(work_dir: &Path) -> Result<u64> {
    if !work_dir.exists() { return Ok(0); }
    let mut count = 0u64;
    if let Ok(entries) = std::fs::read_dir(work_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                if matches!(ext, "o" | "cf" | "vcd" | "ghw" | "fst") {
                    if std::fs::remove_file(&path).is_ok() {
                        count += 1;
                    }
                }
            }
        }
    }
    Ok(count)
}

struct ParsedError {
    _file: String,
    line: u32,
    col: u32,
    severity: String,
    message: String,
}

fn parse_ghdl_error(line: &str) -> Option<ParsedError> {
    let caps = ghdl_error_re().captures(line)?;
    Some(ParsedError {
        _file: caps[1].to_string(),
        line: caps[2].parse().unwrap_or(0),
        col: caps[3].parse().unwrap_or(0),
        severity: caps[4].to_string(),
        message: caps[5].to_string(),
    })
}
