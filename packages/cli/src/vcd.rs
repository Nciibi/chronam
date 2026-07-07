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

fn grn(s: &str) -> String { format!("\x1b[32m{}\x1b[0m", s) }
fn bgrn(s: &str) -> String { format!("\x1b[92m{}\x1b[0m", s) }
fn dim_grn(s: &str) -> String { format!("\x1b[2;32m{}\x1b[0m", s) }

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
        return w as usize;
    }
    std::env::var("COLUMNS").ok().and_then(|s| s.parse().ok()).unwrap_or(120)
}

fn build_tree(signals: &[Signal]) -> Vec<(usize, &Signal)> {
    struct Node<'a> {
        depth: usize,
        sig: &'a Signal,
        name_part: &'a str,
    }

    let mut roots: Vec<Vec<Node>> = Vec::new();
    let mut sigs: Vec<(&Signal, Vec<&str>)> = signals.iter().map(|s| {
        let parts: Vec<&str> = s.name.split('.').collect();
        (s, parts)
    }).collect();

    sigs.sort_by(|a, b| a.1.cmp(&b.1));

    let mut result = Vec::new();
    for (sig, parts) in &sigs {
        let depth = parts.len().saturating_sub(1);
        result.push((depth, *sig));
    }
    result
}

fn render_time_ruler(cols: usize, step: u64) -> String {
    let mut out = String::new();
    out.push_str(&format!("  {:>24} ", dim_grn("ns")));

    let mut c = 0usize;
    while c < cols {
        if c % 10 == 0 {
            let t_ns = (c as u64 * step) / 1_000_000;
            let label = format!("{}", t_ns);
            out.push_str(&dim_grn(&label));
            c += label.len();
        } else if c % 5 == 0 {
            out.push_str(&dim_grn("·"));
            c += 1;
        } else {
            out.push(' ');
            c += 1;
        }
    }
    out.push('\n');

    out.push_str(&format!("  {:>24} ", ""));
    for c in 0..cols {
        if c % 10 == 0 {
            out.push_str(&dim_grn("┼"));
        } else if c % 5 == 0 {
            out.push_str(&dim_grn("·"));
        } else {
            out.push_str(&dim_grn("─"));
        }
    }
    out.push('\n');

    out
}

fn render_bit_signal(changes: &[&ValueChange], cols: usize, step: u64) -> String {
    let mut out = String::new();

    let mut prev_val = get_value_at(changes, 0, '0');
    for c in 0..cols {
        let t = c as u64 * step;
        let val = get_value_at(changes, t, '0');
        let next_t = ((c as u64 + 1) * step);
        let next_val = get_value_at(changes, next_t, '0');

        let ch = match (val, next_val) {
            ('0', '0') => '_',
            ('1', '1') => '\u{2594}',
            ('0', '1') => '\u{2571}',
            ('1', '0') => '\u{2572}',
            _ => '_',
        };
        out.push(ch);
        prev_val = val;
    }

    grn(&out)
}

fn render_bus_signal(changes: &[&ValueChange], cols: usize, step: u64, width: u32) -> String {
    let initial = "0".repeat(width as usize);
    let mut displayed = String::new();
    let mut out = String::new();
    let mut c = 0usize;

    while c < cols {
        let t = c as u64 * step;
        let val = get_bin_value_at(changes, t, &initial);
        let hex = bin_to_hex(&val);

        if hex != displayed {
            let hlen = hex.len();
            let end = (c + hlen).min(cols);
            let space = end - c;
            if hlen > 0 && space >= hlen.saturating_sub(1) {
                let label = if hlen == 1 {
                    format!("{}", &hex[..space.min(hlen)])
                } else if space >= hlen {
                    let mut s = String::new();
                    s.push_str(&hex[..1]);
                    for i in 1..hlen {
                        s.push(' ');
                        if i < space {
                            s.push_str(&hex[i..=i]);
                        }
                    }
                    s
                } else {
                    hex.chars().take(space).collect()
                };
                out.push_str(&grn(&label));
                c += end - c;
                displayed = hex;
                continue;
            }
        }
        out.push_str(&grn("▁"));
        c += 1;
    }

    out
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

    let cols = terminal_cols().saturating_sub(28).max(20);

    let max_time_fs = time_window_ns * 1_000_000;
    let time_step = (max_time_fs / cols as u64).max(1);

    let mut out = String::new();
    let timeline = render_time_ruler(cols, time_step);
    out.push_str(&timeline);

    let tree = build_tree(data.signals.iter().collect::<Vec<_>>().as_slice());
    let tree_lookup: HashMap<&str, usize> = tree.iter()
        .map(|(d, s)| (s.id.as_str(), *d))
        .collect();

    for sig in &signal_filter {
        let depth = tree_lookup.get(sig.id.as_str()).copied().unwrap_or(0);
        let prefix = if depth == 0 {
            String::new()
        } else if depth <= 2 {
            "  ".repeat(depth)
        } else {
            "  ".repeat(2) + "…" + &"  ".repeat(depth - 2)
        };

        let display_name = if let Some(dot) = sig.name.rfind('.') {
            &sig.name[dot + 1..]
        } else {
            &sig.name
        };

        let name_str = format!("{}{}", prefix, display_name);
        out.push_str(&format!("  {} │ ", bgrn(&format!("{:>24}", name_str))));

        let changes: Vec<&ValueChange> = data.changes.iter()
            .filter(|c| c.id == sig.id)
            .collect();

        if sig.width == 1 {
            out.push_str(&render_bit_signal(&changes, cols, time_step));
        } else {
            out.push_str(&render_bus_signal(&changes, cols, time_step, sig.width));
        }
        out.push('\n');
    }

    out
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
