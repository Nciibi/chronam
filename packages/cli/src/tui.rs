use std::io;
use std::time::Duration;

use crossterm::event::{self, Event, KeyCode, KeyEventKind, MouseButton, MouseEventKind};
use crossterm::terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen};
use crossterm::ExecutableCommand;

use ratatui::layout::{Constraint, Direction, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, Paragraph, Scrollbar, ScrollbarOrientation, ScrollbarState};
use ratatui::{Frame, Terminal};

use crate::vcd::{self, VcdData};

const NAME_W: u16 = 22;

fn value_at(changes: &[(u64, String)], time_fs: u64, default: &str) -> String {
    let mut val = default.to_string();
    for (t, v) in changes {
        if *t <= time_fs {
            val = v.clone();
        }
    }
    val
}

fn bin_to_hex(s: &str) -> String {
    let bin = s.trim_start_matches('0');
    if bin.is_empty() {
        return "0".to_string();
    }
    let padded = format!("{:0>width$}", bin, width = (bin.len() + 3) / 4 * 4);
    let mut hex = String::new();
    for chunk in padded.as_bytes().chunks(4) {
        let s = std::str::from_utf8(chunk).unwrap_or("0000");
        let v = u8::from_str_radix(s, 2).unwrap_or(0);
        hex.push_str(&format!("{:X}", v));
    }
    hex.trim_start_matches('0').to_string()
}

pub fn run_interactive(data: &VcdData) -> io::Result<()> {
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    stdout.execute(EnterAlternateScreen)?;
    let backend = ratatui::backend::CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let total_fs = data.changes.last().map(|c| c.time).unwrap_or(0).max(1);
    let window = total_fs.min(200_000_000_000); // 200 ns default

    let changes_by_id: Vec<Vec<(u64, String)>> = data
        .signals
        .iter()
        .map(|sig| {
            let mut cv: Vec<(u64, String)> = data
                .changes
                .iter()
                .filter(|c| c.id == sig.id)
                .map(|c| (c.time, c.value.clone()))
                .collect();
            cv.sort_by_key(|(t, _)| *t);
            cv
        })
        .collect();

    let mut scroll: usize = 0;
    let mut win_start: u64 = 0;
    let mut win_end: u64 = window;
    let mut cursor_time: Option<u64> = None;
    let mut cursor_col: Option<u16> = None;

    let tick = Duration::from_millis(50);

    loop {
        terminal.draw(|f| {
            let area = f.size();
            let vert = Layout::vertical([
                Constraint::Length(2),
                Constraint::Min(1),
                Constraint::Length(1),
            ])
            .split(area);

            render_ruler(f, vert[0], win_start, win_end, data, cursor_time);
            render_waves(
                f,
                vert[1],
                win_start,
                win_end,
                &mut scroll,
                data,
                &changes_by_id,
                &mut cursor_time,
                &mut cursor_col,
            );
            render_status(f, vert[2], win_start, win_end, cursor_time, scroll, data.signals.len());
        })?;

        if !event::poll(tick)? {
            continue;
        }

        match event::read()? {
            Event::Key(k) if k.kind == KeyEventKind::Press => match k.code {
                KeyCode::Char('q') | KeyCode::Esc => break,
                KeyCode::Char('j') | KeyCode::Down => {
                    scroll = scroll.saturating_add(1).min(data.signals.len().saturating_sub(1));
                }
                KeyCode::Char('k') | KeyCode::Up => scroll = scroll.saturating_sub(1),
                KeyCode::Char('h') | KeyCode::Left => {
                    let step = (win_end - win_start) / 4;
                    win_start = win_start.saturating_sub(step);
                    win_end = win_end.saturating_sub(step);
                    if win_end < 1000 {
                        win_start = 0;
                        win_end = window.min(total_fs);
                    }
                }
                KeyCode::Char('l') | KeyCode::Right => {
                    let step = (win_end - win_start) / 4;
                    win_start = (win_start + step).min(total_fs.saturating_sub(1000));
                    win_end = (win_end + step).min(total_fs);
                    if win_end - win_start < 1000 {
                        win_end = total_fs;
                        win_start = total_fs.saturating_sub(1000);
                    }
                }
                KeyCode::Char('+') | KeyCode::Char('=') => {
                    let c = (win_start + win_end) / 2;
                    let half = (win_end - win_start) / 4;
                    win_start = c.saturating_sub(half);
                    win_end = (c + half).min(total_fs).max(win_start + 1000);
                }
                KeyCode::Char('-') | KeyCode::Char('_') => {
                    let c = (win_start + win_end) / 2;
                    let span = (win_end - win_start).min(total_fs / 2);
                    win_start = c.saturating_sub(span);
                    win_end = (c + span).min(total_fs).max(win_start + 1000);
                }
                KeyCode::Char('c') => cursor_time = None,
                _ => {}
            },
            Event::Mouse(m) => match m.kind {
                MouseEventKind::Down(MouseButton::Left) => {
                    let wave_cols = area_width(NAME_W);
                    if m.column > NAME_W + 2 && (m.row as usize) >= 2 && (m.row as usize) < area_height() - 1 {
                        let col = m.column.saturating_sub(NAME_W + 3);
                        let ratio = col as f64 / wave_cols.max(1) as f64;
                        let time = win_start + ((win_end - win_start) as f64 * ratio) as u64;
                        cursor_time = Some(time);
                        cursor_col = Some(col);
                    }
                }
                MouseEventKind::ScrollDown => {
                    scroll = scroll.saturating_add(3).min(data.signals.len().saturating_sub(1));
                }
                MouseEventKind::ScrollUp => {
                    scroll = scroll.saturating_sub(3);
                }
                _ => {}
            },
            Event::Resize(_, _) => {
                cursor_col = None;
            }
            _ => {}
        }
    }

    disable_raw_mode()?;
    io::stdout().execute(LeaveAlternateScreen)?;
    Ok(())
}

fn area_width(name_w: u16) -> u16 {
    120u16.saturating_sub(name_w + 4)
}

fn area_height() -> u16 {
    40u16
}

fn render_ruler(
    f: &mut Frame,
    area: Rect,
    win_start: u64,
    win_end: u64,
    _data: &VcdData,
    cursor: Option<u64>,
) {
    if area.width < 10 {
        return;
    }
    let wave_cols = area.width.saturating_sub(NAME_W + 3);
    let step = (win_end - win_start) / wave_cols.max(1) as u64;

    let mut label_line = String::new();
    label_line.push_str(&" ".repeat(NAME_W as usize + 3));

    let mut c = 0usize;
    while c < wave_cols as usize {
        if c % 10 == 0 {
            let t_ns = (win_start + c as u64 * step) / 1_000_000;
            let lbl = format!("{}", t_ns);
            label_line.push_str(&lbl);
            c += lbl.len();
        } else {
            label_line.push(' ');
            c += 1;
        }
    }

    let mut grid_line = String::new();
    grid_line.push_str(&" ".repeat(NAME_W as usize + 3));
    for c in 0..wave_cols as usize {
        if c % 10 == 0 {
            grid_line.push('┼');
        } else if c % 5 == 0 {
            grid_line.push('·');
        } else {
            grid_line.push('─');
        }
    }

    let dim = Style::default().fg(Color::DarkGray);

    let labels = Paragraph::new(Line::from(Span::styled(label_line, dim)));
    let grid = Paragraph::new(Line::from(Span::styled(grid_line, dim)));

    let vert = Layout::vertical([Constraint::Length(1), Constraint::Length(1)]).split(area);
    f.render_widget(labels, vert[0]);
    f.render_widget(grid, vert[1]);
}

#[allow(clippy::too_many_arguments)]
fn render_waves(
    f: &mut Frame,
    area: Rect,
    win_start: u64,
    win_end: u64,
    scroll: &mut usize,
    data: &VcdData,
    changes_by_id: &[Vec<(u64, String)>],
    cursor_time: &mut Option<u64>,
    cursor_col: &mut Option<u16>,
) {
    let rows = area.height as usize;
    let wave_cols = area.width.saturating_sub(NAME_W + 3) as usize;
    if wave_cols < 5 || rows == 0 {
        return;
    }

    let step = (win_end - win_start) / wave_cols.max(1) as u64;
    let total = data.signals.len();
    *scroll = (*scroll).min(total.saturating_sub(1));

    let mut lines: Vec<Line> = Vec::with_capacity(rows);

    let grn = Style::default().fg(Color::Green);
    let bgrn = Style::default().fg(Color::Green).add_modifier(Modifier::BOLD);
    let cursor_style = Style::default().fg(Color::Cyan);

    for i in *scroll..total.min(*scroll + rows) {
        let sig = &data.signals[i];
        let changes = &changes_by_id[i];

        let display_name = sig.name.rsplit('.').next().unwrap_or(&sig.name);
        let depth = sig.name.chars().filter(|&c| c == '.').count();
        let indent: String = (0..depth).map(|_| "  ").collect();
        let name_str = format!("{}{}", indent, display_name);
        let padded = if name_str.len() > NAME_W as usize {
            format!("..{}", &name_str[name_str.len().saturating_sub(NAME_W as usize - 2)..])
        } else {
            format!("{:>width$}", name_str, width = NAME_W as usize)
        };

        let mut wave = String::with_capacity(wave_cols);

        if sig.width == 1 {
            for c in 0..wave_cols {
                let t = win_start + c as u64 * step;
                let nt = (win_start + (c as u64 + 1) * step).min(win_end);
                let val = value_at(changes, t, "0");
                let nval = value_at(changes, nt, "0");
                let ch = match (val.as_str(), nval.as_str()) {
                    ("0", "0") => '_',
                    ("1", "1") => '\u{2594}',
                    ("0", "1") => '\u{2571}',
                    ("1", "0") => '\u{2572}',
                    _ => '_',
                };
                wave.push(ch);
            }
        } else {
            let zero = "0".repeat(sig.width as usize);
            let mut displayed = String::new();
            let mut c = 0usize;
            while c < wave_cols {
                let t = win_start + c as u64 * step;
                let val = value_at(changes, t, &zero);
                let hex = bin_to_hex(&val);
                if hex != displayed && !hex.is_empty() {
                    let hlen = hex.len();
                    let fit = (wave_cols - c).min(hlen + 1);
                    if fit >= hlen {
                        wave.push_str(&hex);
                        c += hlen;
                        displayed = hex;
                        continue;
                    }
                }
                wave.push('_');
                c += 1;
            }
        }

        let name_span = Span::styled(padded, bgrn);
        let sep = Span::raw(" │ ");
        let wave_span = Span::styled(wave, grn);

        let mut spans = vec![name_span, sep, wave_span];

        if let Some(ct) = cursor_time {
            let cursor_idx = if win_end > win_start {
                let idx = ((ct - win_start) as f64 / (win_end - win_start) as f64 * wave_cols as f64) as usize;
                idx.min(wave_cols.saturating_sub(1))
            } else {
                0
            };
            if cursor_idx < wave_cols {
                let pre = &wave[..cursor_idx];
                let at = wave[cursor_idx..].chars().next().unwrap_or(' ');
                let post = &wave[cursor_idx + 1..];
                spans = vec![
                    name_span,
                    sep,
                    Span::styled(pre.to_string(), grn),
                    Span::styled(at.to_string(), cursor_style),
                    Span::styled(post.to_string(), grn),
                ];
            }
        }

        lines.push(Line::from(spans));
    }

    let p = Paragraph::new(lines);
    f.render_widget(p, area);
}

fn render_status(
    f: &mut Frame,
    area: Rect,
    win_start: u64,
    win_end: u64,
    cursor: Option<u64>,
    scroll: usize,
    total_sigs: usize,
) {
    let dur_ns = (win_end - win_start) / 1_000_000;
    let cursor_str = match cursor {
        Some(t) => format!(" │ Cursor: {} ns", t / 1_000_000),
        None => String::new(),
    };
    let text = format!(
        " Signals: {}/{} │ View: {} ns [{:.1}–{:.1} ns]{} │ jk↑↓ scroll │ hl←→ pan │ +- zoom │ c clear │ q quit",
        scroll + 1,
        total_sigs,
        dur_ns,
        win_start as f64 / 1_000_000.0,
        win_end as f64 / 1_000_000.0,
        cursor_str,
    );
    let style = Style::default().fg(Color::DarkGray);
    let p = Paragraph::new(Line::from(Span::styled(text, style)));
    f.render_widget(p, area);
}
