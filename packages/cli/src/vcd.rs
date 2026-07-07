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

const GRN: &str = "\x1b[32m";
const BGRN: &str = "\x1b[92m";
const DIMGRN: &str = "\x1b[2;32m";
const RESET: &str = "\x1b[0m";

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
        if line.is_empty() { continue; }

        if in_header {
            if line.starts_with("$timescale") {
                timescale = line
                    .trim_start_matches("$timescale")
                    .trim_end_matches("$end").trim().to_string();
            } else if line.starts_with("$scope") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 3 { scope_stack.push(parts[2].to_string()); }
            } else if line.starts_with("$upscope") {
                scope_stack.pop();
            } else if line.starts_with("$var") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 4 {
                    let _var_type = parts[1];
                    let width: u32 = parts[2].parse().unwrap_or(1);
                    let id = parts[3].to_string();
                    let name = if parts.len() > 4 { parts[4].to_string() }
                                else { format!("unnamed_{}", id) };
                    let scope = scope_stack.join(".");
                    let full_name = if scope.is_empty() { name }
                                    else { format!("{}.{}", scope, name) };
                    let sig = Signal { name: full_name, width, id: id.clone() };
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

    Ok(VcdData { timescale, signals, id_to_signal, changes })
}

pub fn render_timing_diagram(data: &VcdData, signal_names: &[String], time_window_ns: u64) -> String {
    let mut signal_filter: Vec<&Signal> = if signal_names.is_empty() {
        data.signals.iter().collect()
    } else {
        data.signals.iter()
            .filter(|s| signal_names.iter().any(|n| s.name.contains(n)))
            .collect()
    };

    if signal_filter.is_empty() {
        signal_filter = data.signals.iter().collect();
    }

    let max_time_fs = time_window_ns * 1_000_000;
    let num_cols = 80usize.min((max_time_fs / 100_000) as usize + 1).max(10);
    let time_step = (max_time_fs / num_cols as u64).max(1);

    let mut out = String::new();
    let name_width = 24usize;

    // Title bar
    let title = format!("{}Waveform Viewer{}  {} window", BGRN, RESET, fmt_time(time_window_ns));
    out.push_str(&format!("  {}\n\n", title));

    // Build change maps per signal for O(1) lookup
    let mut sig_map: HashMap<&str, Vec<&ValueChange>> = HashMap::new();
    for sig in &signal_filter {
        let sc: Vec<&ValueChange> = data.changes.iter().filter(|c| c.id == sig.id).collect();
        sig_map.insert(&sig.id, sc);
    }

    // Per-signal rendering
    for sig in &signal_filter {
        let changes = sig_map.get(sig.id.as_str()).unwrap();

        // Signal name label
        let label = if sig.name.len() > name_width {
            format!("...{}", &sig.name[sig.name.len()-name_width+3..])
        } else {
            sig.name.clone()
        };

        out.push_str(&format!("  {}{:>width$}{} {}",
            BGRN, label, RESET, GRN, width = name_width));

        if sig.width == 1 {
            render_bit_signal(&mut out, changes, num_cols, time_step, max_time_fs);
        } else {
            render_bus_signal(&mut out, changes, num_cols, time_step, sig.width, max_time_fs);
        }

        out.push_str(&format!("{}\n", RESET));
    }

    // Time axis
    render_time_axis(&mut out, num_cols, time_step, name_width);

    out
}

fn render_bit_signal(out: &mut String, changes: &[&ValueChange], cols: usize, step: u64, max_fs: u64) {
    for c in 0..cols {
        let t = c as u64 * step;
        let next_t = ((c as u64 + 1) * step).min(max_fs);
        let val = get_value_at(changes, t, '0');
        let next_val = get_value_at(changes, next_t, '0');

        let ch = match (val, next_val) {
            ('0', '0') => '_',
            ('1', '1') => '\u{2594}',
            ('0', '1') => '\u{256D}',
            ('1', '0') => '\u{2570}',
            _ => '_',
        };
        out.push(ch);
    }
}

fn render_bus_signal(out: &mut String, changes: &[&ValueChange], cols: usize, step: u64, width: u32, _max_fs: u64) {
    let initial = "0".repeat(width as usize);
    let mut display_buf = String::new();
    let mut c = 0usize;

    while c < cols {
        let t = c as u64 * step;
        let val = get_bin_value_at(changes, t, &initial);
        let hex = bin_to_hex(&val);

        if hex != display_buf {
            print_hex_val(out, &hex, c, cols, &mut c);
            display_buf = hex;
        } else {
            out.push('_');
            c += 1;
        }
    }
}

fn print_hex_val(out: &mut String, hex: &str, _col: usize, cols: usize, c: &mut usize) {
    let hlen = hex.len();
    if *c + hlen < cols {
        out.push_str(hex);
        *c += hlen;
    } else {
        let remain = cols - *c;
        for ch in hex.chars().take(remain) {
            out.push(ch);
        }
        *c += remain;
    }
}

fn render_time_axis(out: &mut String, cols: usize, step: u64, name_width: usize) {
    // Time labels
    out.push_str(&format!("  {:>width$} {}{}", "Time", DIMGRN, RESET, width = name_width));
    for c in 0..cols {
        if c % 10 == 0 {
            let t_ns = (c as u64 * step) / 1_000_000;
            let label = format!("{}", t_ns);
            out.push_str(&format!("{}{}{}", DIMGRN, label, RESET));
            let skip = label.len().saturating_sub(1);
            for _ in 0..skip {
                if c + 1 < cols { out.push(' '); }
            }
        } else {
            out.push_str(&format!("{}·{}", DIMGRN, RESET));
        }
    }
    out.push('\n');

    // Grid line
    out.push_str(&format!("  {:>width$} {}", "", DIMGRN, width = name_width));
    for c in 0..cols {
        if c % 10 == 0 {
            out.push('|');
        } else {
            out.push('─');
        }
    }
    out.push_str(&format!("{}\n", RESET));
}

fn get_value_at(changes: &[&ValueChange], time: u64, default: char) -> char {
    let mut val = default;
    for c in changes {
        if c.time <= time { val = c.value.chars().next().unwrap_or(default); }
    }
    val
}

fn get_bin_value_at(changes: &[&ValueChange], time: u64, default: &str) -> String {
    let mut val = default.to_string();
    for c in changes {
        if c.time <= time { val = c.value.clone(); }
    }
    val
}

fn bin_to_hex(bin: &str) -> String {
    let bin = bin.trim_start_matches('0');
    if bin.is_empty() { return "0".to_string(); }
    let padded = format!("{:0>width$}", bin, width = (bin.len() + 3) / 4 * 4);
    let mut hex = String::new();
    for chunk in padded.as_bytes().chunks(4) {
        let s = std::str::from_utf8(chunk).unwrap_or("0000");
        let val = u8::from_str_radix(s, 2).unwrap_or(0);
        hex.push_str(&format!("{:X}", val));
    }
    hex.trim_start_matches('0').to_string()
}

fn fmt_time(ns: u64) -> String {
    if ns >= 1_000_000 {
        format!("{} ms", ns / 1_000_000)
    } else if ns >= 1_000 {
        format!("{} us", ns / 1_000)
    } else {
        format!("{} ns", ns)
    }
}
