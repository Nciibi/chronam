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
    pub signals: Vec<Signal>,
    pub id_to_signal: HashMap<String, Signal>,
    pub changes: Vec<ValueChange>,
}

pub fn parse(path: &Path) -> Result<VcdData> {
    let content = std::fs::read_to_string(path)?;
    let mut signals = Vec::new();
    let mut id_to_signal = HashMap::new();
    let mut changes = Vec::new();
    let mut in_header = true;
    let mut scope_stack: Vec<String> = vec!["".to_string()];
    let mut current_time: u64 = 0;

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() { continue; }

        if in_header {
            if line.starts_with("$scope") {
                if let Some(name) = line.split_whitespace().nth(2) {
                    scope_stack.push(name.to_string());
                }
            } else if line.starts_with("$upscope") {
                scope_stack.pop();
            } else if line.starts_with("$var") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 4 {
                    let width: u32 = parts[2].parse().unwrap_or(1);
                    let id = parts[3].to_string();
                    let name = if parts.len() > 4 { parts[4].to_string() }
                                else { format!("unnamed_{}", id) };
                    let full_name = if scope_stack.len() > 1 {
                        format!("{}.{}", scope_stack[1..].join("."), name)
                    } else {
                        name
                    };
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
        } else if line.len() <= 2 {
            let val = &line[..line.len().saturating_sub(1)];
            let id = &line[line.len().saturating_sub(1)..];
            if !id.is_empty() {
                changes.push(ValueChange {
                    time: current_time,
                    id: id.to_string(),
                    value: if val.is_empty() { "0".to_string() } else { val.to_string() },
                });
            }
        }
    }

    Ok(VcdData { signals, id_to_signal, changes })
}

fn terminal_cols() -> usize {
    if let Ok((w, _)) = crossterm::terminal::size() {
        return (w as usize).max(40);
    }
    std::env::var("COLUMNS").ok().and_then(|s| s.parse().ok()).unwrap_or(120)
}

fn build_tree(signals: &[&Signal]) -> HashMap<String, usize> {
    let mut result = HashMap::new();
    for sig in signals {
        let depth = sig.name.chars().filter(|&c| c == '.').count();
        result.insert(sig.id.clone(), depth);
    }
    result
}

fn fmt_dim(s: &str) -> String {
    format!("\x1b[2;32m{}\x1b[0m", s)
}

fn fmt_wave(s: &str) -> String {
    format!("\x1b[92m{}\x1b[0m", s)
}

fn fmt_name(s: &str) -> String {
    format!("\x1b[92m{}\x1b[0m", s)
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

    let total_cols = terminal_cols();
    let name_width = 26usize;
    let wave_cols = total_cols.saturating_sub(name_width + 4).max(20);

    let max_time_fs = time_window_ns * 1_000_000;
    let time_step = (max_time_fs / wave_cols as u64).max(1);

    let mut out = String::new();

    // ── Time ruler ──
    build_time_ruler(&mut out, wave_cols, time_step, name_width);

    // ── Build depth map for hierarchy ──
    let depth_map = build_tree(&signal_filter);

    // ── Signal rows ──
    for sig in &signal_filter {
        let depth = depth_map.get(&sig.id).copied().unwrap_or(0);
        let display_name = sig.name.rsplit('.').next().unwrap_or(&sig.name);
        let tree_prefix: String = (0..depth).map(|_| "  ").collect();
        let padded = format!("{}{}", tree_prefix, display_name);
        let truncated = if padded.len() > name_width {
            format!("..{}", &padded[padded.len().saturating_sub(name_width - 2)..])
        } else {
            format!("{:>width$}", padded, width = name_width)
        };

        out.push_str(&format!("  {} │ ", fmt_name(&truncated)));

        let changes: Vec<&ValueChange> = data.changes.iter()
            .filter(|c| c.id == sig.id)
            .collect();

        if sig.width == 1 {
            render_bit_wave(&mut out, &changes, wave_cols, time_step);
        } else {
            render_bus_wave(&mut out, &changes, wave_cols, time_step, sig.width);
        }
        out.push('\n');
    }

    out
}

fn build_time_ruler(out: &mut String, cols: usize, step: u64, name_width: usize) {
    // Ruler row: time labels
    out.push_str(&format!("  {:>width$} ", "", width = name_width));
    let mut label_line = String::new();
    let mut c = 0usize;
    while c < cols {
        if c % 10 == 0 {
            let t_ns = (c as u64 * step) / 1_000_000;
            let lbl = format!("{}", t_ns);
            label_line.push_str(&lbl);
            c += lbl.len();
        } else {
            label_line.push(' ');
            c += 1;
        }
    }
    out.push_str(&fmt_dim(&label_line));
    out.push('\n');

    // Grid row: ┼ at deciles, · at quintiles, ─ elsewhere
    out.push_str(&format!("  {:>width$} ", "", width = name_width));
    let mut grid_line = String::new();
    for c in 0..cols {
        if c % 10 == 0 {
            grid_line.push('┼');
        } else if c % 5 == 0 {
            grid_line.push('·');
        } else {
            grid_line.push('─');
        }
    }
    out.push_str(&fmt_dim(&grid_line));
    out.push('\n');
}

fn render_bit_wave(out: &mut String, changes: &[&ValueChange], cols: usize, step: u64) {
    let mut wave = String::with_capacity(cols);
    for c in 0..cols {
        let t = c as u64 * step;
        let next_t = (c as u64 + 1) * step;
        let val = get_value_at(changes, t, '0');
        let next_val = get_value_at(changes, next_t, '0');

        wave.push(match (val, next_val) {
            ('0', '0') => '_',
            ('1', '1') => '\u{2594}',
            ('0', '1') => '\u{2571}',
            ('1', '0') => '\u{2572}',
            _ => '_',
        });
    }
    out.push_str(&fmt_wave(&wave));
}

fn render_bus_wave(out: &mut String, changes: &[&ValueChange], cols: usize, step: u64, width: u32) {
    let initial = "0".repeat(width as usize);
    let mut displayed = String::new();
    let mut wave = String::with_capacity(cols);
    let mut c = 0usize;

    while c < cols {
        let t = c as u64 * step;
        let val = get_bin_value_at(changes, t, &initial);
        let hex = bin_to_hex(&val);

        if hex != displayed && !hex.is_empty() {
            let hlen = hex.len();
            let fit = (cols - c).min(hlen + 1);
            if fit >= hlen {
                wave.push_str(&hex);
                c += hlen;
                displayed = hex;
                continue;
            }
        }
        wave.push('\u{2581}');
        c += 1;
    }

    out.push_str(&fmt_wave(&wave));
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
