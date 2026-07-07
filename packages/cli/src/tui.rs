use std::io;
use std::time::Duration;

use crossterm::event::{self, Event, KeyCode, KeyEventKind, MouseEventKind};
use crossterm::event::{DisableMouseCapture, EnableMouseCapture};
use crossterm::terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen};
use crossterm::ExecutableCommand;

use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::Paragraph;
use ratatui::Terminal;

use crate::vcd::VcdData;

fn val_at(changes: &[(u64, String)], t: u64, def: &str) -> String {
    let mut v = def.to_string();
    for (ct, cv) in changes {
        if *ct <= t { v = cv.clone(); }
    }
    v
}

fn to_hex(s: &str) -> String {
    let b = s.trim_start_matches('0');
    if b.is_empty() { return "0".to_string(); }
    let p = format!("{:0>w$}", b, w = (b.len() + 3) / 4 * 4);
    let mut h = String::new();
    for c in p.as_bytes().chunks(4) {
        let s = std::str::from_utf8(c).unwrap_or("0000");
        h.push_str(&format!("{:X}", u8::from_str_radix(s, 2).unwrap_or(0)));
    }
    h.trim_start_matches('0').to_string()
}

fn build_wave_bit(ch: &[(u64, String)], cols: usize, step: u64, t_start: u64) -> String {
    let mut s = String::with_capacity(cols);
    for c in 0..cols {
        let t = t_start + c as u64 * step;
        let nt = t + step;
        let v = val_at(ch, t, "0");
        let nv = val_at(ch, nt, "0");
        s.push(match (v.as_str(), nv.as_str()) {
            ("0", "0") => '_',
            ("1", "1") => '\u{2594}',
            ("0", "1") => '\u{2571}',
            ("1", "0") => '\u{2572}',
            _ => '_',
        });
    }
    s
}

fn build_wave_bus(ch: &[(u64, String)], cols: usize, step: u64, t_start: u64, width: u32) -> String {
    let zero = "0".repeat(width as usize);
    let mut s = String::with_capacity(cols);
    let mut shown = String::new();
    let mut c = 0;
    while c < cols {
        let t = t_start + c as u64 * step;
        let v = val_at(ch, t, &zero);
        let hx = to_hex(&v);
        if hx != shown && !hx.is_empty() && cols - c >= hx.len() {
            s.push_str(&hx);
            c += hx.len();
            shown = hx;
        } else {
            s.push('_');
            c += 1;
        }
    }
    s
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

    let mut paused = false;
    let win_len = total_fs.min(200_000_000_000);
    let mut scroll_step = 3usize;
    let mut t_start: u64 = 0;

    let tick = Duration::from_millis(30);

    loop {
        terminal.draw(|f| {
            let area = f.area();
            let rows = area.height.saturating_sub(2) as usize;
            let cols = area.width.saturating_sub(4) as usize;
            if cols < 10 || rows < 2 || data.signals.is_empty() {
                return;
            }

            let vis = rows.min(data.signals.len());
            let step = win_len / cols.max(1) as u64;

            let dim = Style::default().fg(Color::DarkGray);
            let grn = Style::default().fg(Color::Green);
            let bgrn = Style::default().fg(Color::Green).add_modifier(Modifier::BOLD);

            let mut lines: Vec<Line> = Vec::new();

            // ─── Header ───
            let play = if paused { "⏸" } else { "▶" };
            let cur_ns = (t_start + win_len / 2) / 1_000_000;
            let win_ns = win_len / 1_000_000;
            lines.push(Line::from(Span::styled(
                format!(" {}  t ≈ {} ns  │ window: {} ns │ {} sigs", play, cur_ns, win_ns, data.signals.len()),
                bgrn,
            )));

            // ─── Data rows ───
            for si in 0..vis {
                let sig = &data.signals[si];
                let ch = &sig_changes[si];
                let name = sig.name.rsplit('.').next().unwrap_or(&sig.name);
                let depth = sig.name.chars().filter(|&c| c == '.').count();
                let indent: String = (0..depth).map(|_| "  ").collect();

                let wave = if sig.width == 1 {
                    build_wave_bit(ch, cols, step, t_start)
                } else {
                    build_wave_bus(ch, cols, step, t_start, sig.width)
                };

                lines.push(Line::from(vec![
                    Span::styled(format!("  {}{}", indent, name), bgrn),
                    Span::raw(" │ "),
                    Span::styled(wave, grn),
                ]));
            }

            while lines.len() < rows + 1 {
                lines.push(Line::from(Span::raw("")));
            }

            // ─── Status ───
            lines.push(Line::from(Span::styled(
                "  space:pause  ←→ speed  q:quit",
                dim,
            )));

            f.render_widget(Paragraph::new(lines), area);
        })?;

        if !event::poll(tick)? {
            if !paused {
                let advance = step * scroll_step as u64;
                t_start = t_start.saturating_add(advance);
                if t_start + win_len > total_fs {
                    t_start = 0;
                }
            }
            continue;
        }

        match event::read()? {
            Event::Key(k) if k.kind == KeyEventKind::Press => match k.code {
                KeyCode::Char('q') | KeyCode::Esc => break,
                KeyCode::Char(' ') => paused = !paused,
                KeyCode::Char('h') | KeyCode::Left => {
                    scroll_step = scroll_step.saturating_sub(1).max(1);
                }
                KeyCode::Char('l') | KeyCode::Right => {
                    scroll_step = (scroll_step + 1).min(20);
                }
                _ => {}
            },
            Event::Mouse(m) => match m.kind {
                MouseEventKind::ScrollDown => {
                    scroll_step = (scroll_step + 1).min(20);
                }
                MouseEventKind::ScrollUp => {
                    scroll_step = scroll_step.saturating_sub(1).max(1);
                }
                _ => {}
            },
            _ => {}
        }
    }

    io::stdout().execute(DisableMouseCapture)?;
    disable_raw_mode()?;
    io::stdout().execute(LeaveAlternateScreen)?;
    Ok(())
}
