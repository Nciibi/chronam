use anyhow::Result;
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone)]
pub struct Signal {
    pub name: String,
    pub width: u32,
    pub id: String,
}

#[derive(Debug, Clone)]
pub struct ValueChange {
    pub time: u64,
    pub id: String,
    pub value: String,
}

#[derive(Debug, Clone)]
pub struct VcdData {
    pub timescale: String,
    pub signals: Vec<Signal>,
    pub id_to_signal: HashMap<String, Signal>,
    pub changes: Vec<ValueChange>,
}

pub fn parse(path: &Path) -> Result<VcdData> {
    let content = std::fs::read_to_string(path)?;
    let mut signals = Vec::new();
    let mut id_to_signal = HashMap::new();
    let mut changes = Vec::new();
    let mut timescale = String::new();
    let mut in_header = true;
    let mut scope_stack: Vec<String> = vec!["".to_string()];
    let mut current_time: u64 = 0;

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        if in_header {
            if line.starts_with("$timescale") {
                timescale = line
                    .trim_start_matches("$timescale")
                    .trim_end_matches("$end")
                    .trim()
                    .to_string();
            } else if line.starts_with("$scope") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 3 {
                    scope_stack.push(parts[2].to_string());
                }
            } else if line.starts_with("$upscope") {
                scope_stack.pop();
            } else if line.starts_with("$var") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 4 {
                    let var_type = parts[1];
                    let width: u32 = parts[2].parse().unwrap_or(1);
                    let id = parts[3].to_string();
                    let name = if parts.len() > 4 {
                        parts[4].to_string()
                    } else {
                        format!("unnamed_{}", id)
                    };
                    let scope = scope_stack.join(".");
                    let full_name = if scope.is_empty() {
                        name.clone()
                    } else {
                        format!("{}.{}", scope, name)
                    };
                    let sig = Signal {
                        name: full_name,
                        width,
                        id: id.clone(),
                    };
                    signals.push(sig.clone());
                    id_to_signal.insert(id, sig);
                }
            } else if line.starts_with("$enddefinitions") {
                in_header = false;
            }
            continue;
        }

        if line.starts_with('#') {
            current_time = line[1..].parse().unwrap_or(0);
            continue;
        }

        if line.starts_with('b') {
            let rest = &line[1..];
            if let Some((val, id)) = rest.rsplit_once(' ') {
                changes.push(ValueChange {
                    time: current_time,
                    id: id.trim().to_string(),
                    value: val.trim().to_string(),
                });
            }
        } else if line.len() == 2 || line.len() == 1 {
            let val = &line[..line.len() - 1];
            let id = &line[line.len() - 1..];
            changes.push(ValueChange {
                time: current_time,
                id: id.to_string(),
                value: val.to_string(),
            });
        }
    }

    Ok(VcdData {
        timescale,
        signals,
        id_to_signal,
        changes,
    })
}

pub fn render_timing_diagram(
    data: &VcdData,
    signal_names: &[String],
    time_window_ns: u64,
) -> String {
    let mut signal_filter: Vec<&Signal> = if signal_names.is_empty() {
        data.signals.iter().collect()
    } else {
        data.signals
            .iter()
            .filter(|s| signal_names.iter().any(|n| s.name.contains(n)))
            .collect()
    };

    if signal_filter.is_empty() {
        signal_filter = data.signals.iter().collect();
    }

    let mut signal_changes: Vec<(usize, Vec<ValueChange>)> = signal_filter
        .iter()
        .map(|sig| {
            let sig_changes: Vec<ValueChange> = data
                .changes
                .iter()
                .filter(|c| c.id == sig.id && c.time <= time_window_ns * 1_000_000)
                .cloned()
                .collect();
            (signal_filter.iter().position(|s| s.id == sig.id).unwrap(), sig_changes)
        })
        .collect();

    let max_time_fs = time_window_ns * 1_000_000;
    let num_cols = 80usize.min((max_time_fs / 100_000) as usize + 1);
    let time_step = (max_time_fs / num_cols as u64).max(1);

    let mut output = String::new();

    let time_scale_label = match data.timescale.to_lowercase().as_str() {
        "1 fs" | "1fs" => "fs",
        "1 ps" | "1ps" => "ps",
        "1 ns" | "1ns" => "ns",
        "1 us" | "1us" => "us",
        _ => "fs",
    };

    output.push_str(&format!("Timing diagram ({} window):\n\n", time_window_ns));

    for (idx, sig) in signal_filter.iter().enumerate() {
        output.push_str(&format!("{:<20} ", sig.name));

        let sig_changes: Vec<&ValueChange> = data
            .changes
            .iter()
            .filter(|c| c.id == sig.id)
            .collect();

        let _label = if sig.width == 1 { "" } else { "" };

        if sig.width == 1 {
            for col in 0..num_cols {
                let t = col as u64 * time_step;
                let val = get_value_at(&sig_changes, t, '0');
                if val == '1' {
                    output.push('\u{203E}');
                } else {
                    output.push('_');
                }
            }
        } else {
            let mut last_val = String::new();
            let mut displayed_at = 0u64;
            for col in 0..num_cols {
                let t = col as u64 * time_step;
                let val = get_bin_value_at(&sig_changes, t, &"0".repeat(sig.width as usize));
                let hex = bin_to_hex(&val);
                if hex != last_val || col == 0 {
                    if t - displayed_at > time_step * 3 || col == num_cols - 1 {
                        let padded = format!("{:>width$}", hex, width = sig.width as usize / 4 + 1);
                        output.push_str(&padded);
                        displayed_at = t;
                        last_val = hex.clone();
                        let skip = padded.len().saturating_sub(1);
                        for _ in 0..skip {
                            if col + 1 < num_cols {
                                output.push(' ');
                            }
                        }
                    } else {
                        output.push('_');
                    }
                } else {
                    output.push('_');
                }
            }
        }
        output.push('\n');
    }

    let time_axis_width = num_cols;
    output.push_str(&format!("{:<20} ", "Time"));
    for col in 0..time_axis_width {
        if col % 10 == 0 {
            let t_ns = (col as u64 * time_step) / 1_000_000;
            let label = format!("{}", t_ns);
            output.push_str(&label);
            let skip = label.len().saturating_sub(1);
            for _ in 0..skip {
                if col + 1 < time_axis_width {
                    output.push(' ');
                }
            }
        } else {
            output.push('.');
        }
    }
    output.push('\n');
    output.push_str(&format!("{:<20} ", ""));
    for col in 0..time_axis_width {
        if col * 100 / time_axis_width % 10 == 0 {
            output.push('|');
        } else {
            output.push('-');
        }
    }
    output.push('\n');

    output
}

fn get_value_at(changes: &[&ValueChange], time: u64, default: char) -> char {
    let mut val = default;
    for c in changes {
        if c.time <= time {
            val = c.value.chars().next().unwrap_or(default);
        }
    }
    val
}

fn get_bin_value_at(changes: &[&ValueChange], time: u64, default: &str) -> String {
    let mut val = default.to_string();
    for c in changes {
        if c.time <= time {
            val = c.value.clone();
        }
    }
    val
}

fn bin_to_hex(bin: &str) -> String {
    let bin = bin.trim_start_matches('0');
    if bin.is_empty() {
        return "0".to_string();
    }
    let padded = format!("{:0>width$}", bin, width = (bin.len() + 3) / 4 * 4);
    let mut hex = String::new();
    for chunk in padded.as_bytes().chunks(4) {
        let s = std::str::from_utf8(chunk).unwrap_or("0000");
        let val = u8::from_str_radix(s, 2).unwrap_or(0);
        hex.push_str(&format!("{:X}", val));
    }
    hex.trim_start_matches('0').to_string()
}
