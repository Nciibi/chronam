use std::io;
use std::time::Duration;

use crossterm::event::{self, Event, KeyCode, KeyEventKind, MouseButton, MouseEventKind};
use crossterm::terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen};
use crossterm::ExecutableCommand;

use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::Paragraph;
use ratatui::{Frame, Terminal};

use crate::vcd::VcdData;

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
    let default_window = total_fs.min(200_000_000_000);

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
    let mut win_end: u64 = default_window;
    let mut cursor_time: Option<u64> = None;

    let tick = Duration::from_millis(50);

    loop {
        terminal.draw(|f| {
            let area = f.area();
            let vert = Layout::vertical([
                Constraint::Length(2),
                Constraint::Min(1),
                Constraint::Length(1),
            ])
            .split(area);

            render_ruler(f, vert[0], win_start, win_end);
            render_waves(f, vert[1], win_start, win_end, &scroll, data, &changes_by_id, cursor_time);
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
                    if win_end > win_start + step {
                        win_start = win_start.saturating_sub(step);
                        win_end = win_end.saturating_sub(step);
                    }
                }
                KeyCode::Char('l') | KeyCode::Right => {
                    let step = (win_end - win_start) / 4;
                    if win_end + step <= total_fs {
                        win_start += step;
                        win_end += step;
                    } else if win_end < total_fs {
                        let diff = total_fs - win_end;
                        win_start += diff;
                        win_end = total_fs;
                    }
                }
                KeyCode::Char('+') | KeyCode::Char('=') => {
                    let c = (win_start + win_end) / 2;
                    let half = (win_end - win_start) / 4;
                    let new_start = c.saturating_sub(half);
                    let new_end = (c + half).min(total_fs).max(new_start + 1000);
                    if new_end > new_start {
                        win_start = new_start;
                        win_end = new_end;
                    }
                }
                KeyCode::Char('-') | KeyCode::Char('_') => {
                    let c = (win_start + win_end) / 2;
                    let span = (win_end - win_start).min(total_fs / 2).max(1000);
                    let new_start = c.saturating_sub(span);
                    let new_end = (c + span).min(total_fs).max(new_start + 1000);
                    if new_end > new_start && new_end - new_start <= total_fs {
                        win_start = new_start;
                        win_end = new_end;
                    }
                }
                KeyCode::Char('c') => cursor_time = None,
                _ => {}
            },
            Event::Mouse(m) => match m.kind {
                MouseEventKind::Down(MouseButton::Left) => {
                    let term_w = crossterm::terminal::size().map(|(w, _)| w).unwrap_or(120);
                    let wave_cols = term_w.saturating_sub(NAME_W + 3);
                    if m.column > NAME_W + 2 {
                        let col = m.column.saturating_sub(NAME_W + 3) as u64;
                        if wave_cols > 0 {
                            let dur = win_end - win_start;
                            let time = win_start + (dur * col / wave_cols as u64);
                            cursor_time = Some(time);
                        }
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
            _ => {}
        }
    }

    disable_raw_mode()?;
    io::stdout().execute(LeaveAlternateScreen)?;
    Ok(())
}

fn render_ruler(f: &mut Frame, area: Rect, win_start: u64, win_end: u64) {
    if area.width < 10 {
        return;
    }
    let wave_cols = area.width.saturating_sub(NAME_W + 3);
    let step = (win_end - win_start) / wave_cols.max(1) as u64;

    let indent = " ".repeat((NAME_W + 3) as usize);
    let dim = Style::default().fg(Color::DarkGray);

    let mut label_line = String::new();
    label_line.push_str(&indent);
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
    grid_line.push_str(&indent);
    for c in 0..wave_cols as usize {
        grid_line.push(if c % 10 == 0 { '┼' } else if c % 5 == 0 { '·' } else { '─' });
    }

    let vert = Layout::vertical([Constraint::Length(1), Constraint::Length(1)]).split(area);
    f.render_widget(Paragraph::new(Line::from(Span::styled(label_line, dim))), vert[0]);
    f.render_widget(Paragraph::new(Line::from(Span::styled(grid_line, dim))), vert[1]);
}

fn render_waves(
    f: &mut Frame,
    area: Rect,
    win_start: u64,
    win_end: u64,
    scroll: &usize,
    data: &VcdData,
    changes_by_id: &[Vec<(u64, String)>],
    cursor_time: Option<u64>,
) {
    let rows = area.height as usize;
    let wave_cols = area.width.saturating_sub(NAME_W + 3) as usize;
    if wave_cols < 5 || rows == 0 {
        return;
    }

    let total = data.signals.len();
    let s = (*scroll).min(total.saturating_sub(1));
    let dur = win_end.saturating_sub(win_start).max(1);
    let step = dur / wave_cols.max(1) as u64;

    let grn = Style::default().fg(Color::Green);
    let bgrn = Style::default().fg(Color::Green).add_modifier(Modifier::BOLD);
    let cursor_style = Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD);

    let cursor_idx = cursor_time.map(|ct| {
        let idx = ((ct - win_start) as f64 / dur as f64 * wave_cols as f64) as usize;
        idx.min(wave_cols.saturating_sub(1))
    });

    let end = total.min(s + rows);
    let mut lines: Vec<Line> = Vec::with_capacity(end - s);

    for i in s..end {
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
                wave.push(match (val.as_str(), nval.as_str()) {
                    ("0", "0") => '_',
                    ("1", "1") => '\u{2594}',
                    ("0", "1") => '\u{2571}',
                    ("1", "0") => '\u{2572}',
                    _ => '_',
                });
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
                    if wave_cols - c >= hlen {
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

        let spans = if let Some(ci) = cursor_idx {
            if ci < wave.len() {
                let pre: String = wave[..ci].chars().collect();
                let post: String = wave[ci..].chars().skip(1).collect();
                vec![
                    name_span,
                    Span::raw(" │ "),
                    Span::styled(pre, grn),
                    Span::styled("║", cursor_style),
                    Span::styled(post, grn),
                ]
            } else {
                vec![name_span, Span::raw(" │ "), Span::styled(wave, grn)]
            }
        } else {
            vec![name_span, Span::raw(" │ "), Span::styled(wave, grn)]
        };

        lines.push(Line::from(spans));
    }

    if end - s < rows {
        for _ in end - s..rows {
            lines.push(Line::from(Span::raw("")));
        }
    }

    f.render_widget(Paragraph::new(lines), area);
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
        " Sig {}/{} │ {} ns [{:.1}–{:.1} ns]{} │ jk scroll │ hl pan │ +- zoom │ c clear │ q quit",
        scroll + 1,
        total_sigs,
        dur_ns,
        win_start as f64 / 1_000_000.0,
        win_end as f64 / 1_000_000.0,
        cursor_str,
    );
    f.render_widget(
        Paragraph::new(Line::from(Span::styled(text, Style::default().fg(Color::DarkGray)))),
        area,
    );
}
