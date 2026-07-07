use std::io;
use std::time::Duration;

use crossterm::event::{self, Event, KeyCode, KeyEventKind, MouseButton, MouseEventKind};
use crossterm::event::{DisableMouseCapture, EnableMouseCapture};
use crossterm::term::disable_raw_mode;
use crossterm::term::enable_raw_mode;
use crossterm::terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen};
use crossterm::ExecutableCommand;

use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::Paragraph;
use ratatui::{Frame, Terminal};

use crate::vcd::VcdData;

fn val_at(changes: &[(u64, String)], t: u64, def: &str) -> String {
    let mut v = def.to_string();
    for (ct, cv) in changes {
        if *ct <= t {
            v = cv.clone();
        }
    }
    v
}

fn to_hex(s: &str) -> String {
    let b = s.trim_start_matches('0');
    if b.is_empty() {
        return "0".to_string();
    }
    let p = format!("{:0>w$}", b, w = (b.len() + 3) / 4 * 4);
    let mut h = String::new();
    for c in p.as_bytes().chunks(4) {
        let s = std::str::from_utf8(c).unwrap_or("0000");
        h.push_str(&format!("{:X}", u8::from_str_radix(s, 2).unwrap_or(0)));
    }
    h.trim_start_matches('0').to_string()
}

pub fn run_interactive(data: &VcdData) -> io::Result<()> {
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    stdout.execute(EnterAlternateScreen)?;
    stdout.execute(EnableMouseCapture)?;
    let backend = ratatui::backend::CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let total_fs = data.changes.last().map(|c| c.time).unwrap_or(1_000_000_000_000).max(1);

    let sig_changes: Vec<Vec<(u64, String)>> = data.signals.iter().map(|sig| {
        let mut v: Vec<(u64, String)> = data.changes.iter()
            .filter(|c| c.id == sig.id)
            .map(|c| (c.time, c.value.clone())).collect();
        v.sort_by_key(|(t, _)| *t);
        v
    }).collect();

    let mut sig_idx = 0usize;
    let mut paused = false;
    let mut win_len = total_fs.min(200_000_000_000); // 200 ns default window
    let mut win_start: u64 = 0;
    let mut sweep_speed = win_len / 200; // advance per frame

    let tick = Duration::from_millis(30);

    loop {
        terminal.draw(|f| {
            let area = f.area();
            let rows = area.height.saturating_sub(3);
            let cols = area.width.saturating_sub(4) as usize;
            if cols < 10 || rows < 2 {
                return;
            }

            let sig = &data.signals[sig_idx];
            let ch = &sig_changes[sig_idx];
            let win_end = (win_start + win_len).min(total_fs);

            let dim = Style::default().fg(Color::DarkGray);
            let grn = Style::default().fg(Color::Green);
            let bgrn = Style::default().fg(Color::Green).add_modifier(Modifier::BOLD);

            let mut lines: Vec<Line> = Vec::new();

            // ─── Header line ───
            let name = sig.name.rsplit('.').next().unwrap_or(&sig.name);
            let dur_ns = (win_end - win_start) / 1_000_000;
            let start_ns = win_start / 1_000_000;
            let end_ns = win_end / 1_000_000;
            let play = if paused { "⏸" } else { "▶" };
            let header = format!(
                " {}  {}  [{} – {} ns]  {} sweep",
                play, name, start_ns, end_ns, dur_ns,
            );
            lines.push(Line::from(Span::styled(header, bgrn)));

            // ─── Waveform area ───
            let wave_rows = rows.saturating_sub(2) as usize;
            let time_step = (win_end - win_start) / cols.max(1) as u64;

            // Build waveform string
            let mut wave_str = String::with_capacity(cols);
            if sig.width == 1 {
                for c in 0..cols {
                    let t = win_start + c as u64 * time_step;
                    let nt = (win_start + (c as u64 + 1) * time_step).min(win_end);
                    let v = val_at(ch, t, "0");
                    let nv = val_at(ch, nt, "0");
                    wave_str.push(match (v.as_str(), nv.as_str()) {
                        ("0", "0") => '_',
                        ("1", "1") => '\u{2594}',
                        ("0", "1") => '\u{2571}',
                        ("1", "0") => '\u{2572}',
                        _ => '_',
                    });
                }
            } else {
                let zero = "0".repeat(sig.width as usize);
                let mut shown = String::new();
                let mut c = 0;
                while c < cols {
                    let t = win_start + c as u64 * time_step;
                    let v = val_at(ch, t, &zero);
                    let hx = to_hex(&v);
                    if hx != shown && !hx.is_empty() && cols - c >= hx.len() {
                        wave_str.push_str(&hx);
                        c += hx.len();
                        shown = hx;
                    } else {
                        wave_str.push('_');
                        c += 1;
                    }
                }
            }

            // Pad wave string to exact width
            while wave_str.len() < cols {
                wave_str.push(' ');
            }

            // Render wave across available rows — each row is the same trace
            // but we want a THICKER visible line, so use 2 chars per signal
            // Actually just render it once in the middle row(s)
            let mid_row = wave_rows / 2;
            for r in 0..wave_rows {
                if r == mid_row {
                    let padded = format!("  {}  ", wave_str);
                    lines.push(Line::from(Span::styled(padded, grn)));
                } else if r == mid_row + 1 && wave_rows > mid_row + 1 {
                    // Grid line below waveform
                    let mut g = String::from("  ");
                    for c in 0..cols {
                        g.push(if c % 10 == 0 { '┼' } else if c % 5 == 0 { '·' } else { '─' });
                    }
                    lines.push(Line::from(Span::styled(g, dim)));
                } else {
                    lines.push(Line::from(Span::raw("")));
                }
            }

            // ─── Status line ───
            let status = format!(
                "  [{}/{}] j↑ k↓  space:pause  ←→ speed  +- zoom  q:quit",
                sig_idx + 1,
                data.signals.len(),
            );
            lines.push(Line::from(Span::styled(status, dim)));

            f.render_widget(Paragraph::new(lines), area);
        })?;

        if !event::poll(tick)? {
            if !paused {
                win_start += sweep_speed;
                if win_start + win_len > total_fs {
                    win_start = 0;
                }
            }
            continue;
        }

        match event::read()? {
            Event::Key(k) if k.kind == KeyEventKind::Press => match k.code {
                KeyCode::Char('q') | KeyCode::Esc => break,
                KeyCode::Char(' ') => paused = !paused,
                KeyCode::Char('j') | KeyCode::Down => {
                    sig_idx = (sig_idx + 1).min(data.signals.len().saturating_sub(1));
                }
                KeyCode::Char('k') | KeyCode::Up => {
                    sig_idx = sig_idx.saturating_sub(1);
                }
                KeyCode::Char('h') | KeyCode::Left => {
                    sweep_speed = sweep_speed.saturating_sub(win_len / 400).max(win_len / 2000);
                }
                KeyCode::Char('l') | KeyCode::Right => {
                    sweep_speed = (sweep_speed + win_len / 400).min(win_len / 10);
                }
                KeyCode::Char('+') | KeyCode::Char('=') => {
                    let c = win_start + win_len / 2;
                    let half = win_len / 4;
                    let ns = c.saturating_sub(half);
                    let ne = (c + half).min(total_fs).max(ns + 1000);
                    if ne > ns {
                        win_len = ne - ns;
                        win_start = ns;
                    }
                }
                KeyCode::Char('-') | KeyCode::Char('_') => {
                    let c = win_start + win_len / 2;
                    let span = win_len.min(total_fs / 2).max(1000);
                    let ns = c.saturating_sub(span);
                    let ne = (c + span).min(total_fs).max(ns + 1000);
                    if ne > ns {
                        win_len = ne - ns;
                        win_start = ns;
                    }
                }
                _ => {}
            },
            Event::Mouse(m) => match m.kind {
                MouseEventKind::ScrollDown => {
                    sig_idx = (sig_idx + 1).min(data.signals.len().saturating_sub(1));
                }
                MouseEventKind::ScrollUp => {
                    sig_idx = sig_idx.saturating_sub(1);
                }
                _ => {}
            },
            _ => {}
        }
    }

    disable_raw_mode()?;
    io::stdout().execute(DisableMouseCapture)?;
    io::stdout().execute(LeaveAlternateScreen)?;
    Ok(())
}
