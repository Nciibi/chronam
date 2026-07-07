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
        if *ct <= t {
            v = cv.clone();
        }
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

fn wave_char(changes: &[(u64, String)], t: u64, nt: u64, width: u32) -> char {
    if width == 1 {
        let v = val_at(changes, t, "0");
        let nv = val_at(changes, nt, "0");
        match (v.as_str(), nv.as_str()) {
            ("0", "0") => '_',
            ("1", "1") => '\u{2594}',
            ("0", "1") => '\u{2571}',
            ("1", "0") => '\u{2572}',
            _ => '_',
        }
    } else {
        ' ' // bus signals use hex labels instead
    }
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
    let win_len = total_fs.min(200_000_000_000); // 200 ns window
    let step_per_col = win_len / 80u64.max(1);
    let mut scroll_step = 2usize; // chars to scroll per frame
    let mut time_cursor: u64 = 0; // current time at the right edge

    // Each signal gets a circular buffer
    let mut buffers: Vec<Vec<char>> = data.signals.iter().map(|_| Vec::new()).collect();

    let tick = Duration::from_millis(30);

    loop {
        terminal.draw(|f| {
            let area = f.area();
            let rows = area.height.saturating_sub(2) as usize;
            let cols = area.width.saturating_sub(4) as usize;
            if cols < 10 || rows < 2 || data.signals.is_empty() {
                return;
            }

            let vis_signals = rows.min(data.signals.len());

            let dim = Style::default().fg(Color::DarkGray);
            let grn = Style::default().fg(Color::Green);
            let bgrn = Style::default().fg(Color::Green).add_modifier(Modifier::BOLD);

            let mut lines: Vec<Line> = Vec::new();

            // ─── Header ───
            let play = if paused { "⏸" } else { "▶" };
            let cur_ns = time_cursor / 1_000_000;
            let win_ns = win_len / 1_000_000;
            lines.push(Line::from(Span::styled(
                format!(" {}  t = {} ns  [window: {} ns]", play, cur_ns, win_ns),
                bgrn,
            )));

            // ─── Grow buffers to fill screen ───
            for (i, buf) in buffers.iter_mut().enumerate() {
                while buf.len() < cols {
                    buf.insert(0, '_');
                }
                if buf.len() > cols {
                    buf.drain(0..buf.len() - cols);
                }
            }

            // ─── Scroll every signal's buffer ───
            if !paused {
                for (i, buf) in buffers.iter_mut().enumerate() {
                    let ch = &sig_changes[i];
                    let sig = &data.signals[i];
                    for _ in 0..scroll_step {
                        buf.remove(0);
                        let t = time_cursor;
                        let nt = time_cursor + step_per_col;
                        let c = if sig.width == 1 {
                            wave_char(ch, t, nt, 1)
                        } else {
                            ' ' // handled below via overlay
                        };
                        buf.push(c);
                    }
                }
                time_cursor += step_per_col * scroll_step as u64;
                if time_cursor > total_fs {
                    time_cursor = 0;
                    for buf in buffers.iter_mut() {
                        buf.clear();
                    }
                }
            }

            // ─── Render signals ───
            for si in 0..vis_signals {
                let sig = &data.signals[si];
                let buf = &buffers[si];
                if buf.is_empty() {
                    continue;
                }
                let name = sig.name.rsplit('.').next().unwrap_or(&sig.name);
                let depth = sig.name.chars().filter(|&c| c == '.').count();
                let indent: String = (0..depth).map(|_| "  ").collect();
                let label = format!("  {}{}", indent, name);

                let mut wave_str: String = buf.iter().collect();

                // For bus signals, overlay hex values
                if sig.width > 1 {
                    let ch = &sig_changes[si];
                    let zero = "0".repeat(sig.width as usize);
                    let mut displayed = String::new();
                    let mut wc = 0usize;
                    let mut new_wave = String::with_capacity(cols);
                    while wc < cols {
                        let t = time_cursor - (cols - wc) as u64 * step_per_col;
                        let v = val_at(ch, t, &zero);
                        let hx = to_hex(&v);
                        if hx != displayed && !hx.is_empty() && cols - wc >= hx.len() {
                            new_wave.push_str(&hx);
                            wc += hx.len();
                            displayed = hx;
                        } else {
                            new_wave.push('_');
                            wc += 1;
                        }
                    }
                    wave_str = new_wave;
                    // Fix buffer for next frame
                    let buf_chars: Vec<char> = wave_str.chars().collect();
                    buffers[si] = buf_chars;
                }

                let sep = if si < vis_signals - 1 { " │ " } else { "   " };
                lines.push(Line::from(vec![
                    Span::styled(label, bgrn),
                    Span::raw(sep),
                    Span::styled(wave_str, grn),
                ]));
            }

            // Fill remaining rows
            while lines.len() < rows + 1 {
                lines.push(Line::from(Span::raw("")));
            }

            // ─── Status ───
            let status = format!(
                "  {} signals  space:pause  ←→ speed  q:quit",
                data.signals.len(),
            );
            lines.push(Line::from(Span::styled(status, dim)));

            f.render_widget(Paragraph::new(lines), area);
        })?;

        if !event::poll(tick)? {
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
                    scroll_step = (scroll_step + 1).min(10);
                }
                _ => {}
            },
            Event::Mouse(m) => match m.kind {
                MouseEventKind::ScrollDown => { scroll_step = (scroll_step + 1).min(10); }
                MouseEventKind::ScrollUp => { scroll_step = scroll_step.saturating_sub(1).max(1); }
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
