use std::io;

use crossterm::event::{DisableMouseCapture, EnableMouseCapture};
use crossterm::terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen};
use crossterm::ExecutableCommand;

use ratatui::layout::{Constraint, Direction, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, List, ListItem, ListState, Paragraph};
use ratatui::Frame;
use ratatui::Terminal;

use crate::app::App;
use crate::vcd::VcdData;
use crate::wave::{SignalState, VcdSource};

fn restore_terminal() {
    let _ = disable_raw_mode();
    let _ = io::stdout().execute(LeaveAlternateScreen);
    let _ = io::stdout().execute(DisableMouseCapture);
}

fn setup_panic_hook() {
    let prev = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |panic| {
        restore_terminal();
        prev(panic);
    }));
}

pub fn run_interactive(data: &VcdData) -> io::Result<()> {
    setup_panic_hook();

    enable_raw_mode()?;
    let mut stdout = io::stdout();
    stdout.execute(EnterAlternateScreen)?;
    stdout.execute(EnableMouseCapture)?;

    let backend = ratatui::backend::CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let total_time_fs = data.changes.last().map(|c| c.time).unwrap_or(1_000_000_000_000).max(1);
    let total_time_ns = total_time_fs as f64 / 1_000_000.0;

    let source = VcdSource::new(data.clone());
    let mut app = App::new(Box::new(source), total_time_ns);

    let result = app.run(&mut terminal);

    restore_terminal();

    result.map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))
}

/// Launch the built-in hospital heart-monitor demo with a synthetic source.
pub fn run_mock(source: crate::wave::MockSource) -> io::Result<()> {
    setup_panic_hook();

    enable_raw_mode()?;
    let mut stdout = io::stdout();
    stdout.execute(EnterAlternateScreen)?;
    stdout.execute(EnableMouseCapture)?;

    let backend = ratatui::backend::CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    // Give the demo a long, looping timeline so the trace scrolls forever.
    let total_time_ns = 100_000.0;
    let mut app = App::new(Box::new(source), total_time_ns);
    app.paused = false;
    app.selected_signal = 4; // start on the ECG channel

    let result = app.run(&mut terminal);

    restore_terminal();

    result.map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))
}

pub fn draw(f: &mut Frame, app: &mut App) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(1),
            Constraint::Length(1),
            Constraint::Min(5),
            Constraint::Length(5),
            Constraint::Length(1),
        ])
        .split(f.area());

    draw_header(f, app, chunks[0]);
    draw_status_bar(f, app, chunks[1]);
    draw_main_area(f, app, chunks[2]);
    draw_info_panel(f, app, chunks[3]);
    draw_help_bar(f, app, chunks[4]);
}

fn draw_header(f: &mut Frame, app: &App, area: Rect) {
    let state_text = if app.paused { "HOLD" } else { "MONITORING" };
    let state_color = if app.paused { app.theme.paused } else { app.theme.trace };

    let line = Line::from(vec![
        Span::styled(
            " ♥ CHRONAM ",
            Style::default()
                .fg(app.theme.background)
                .bg(app.theme.trace)
                .add_modifier(Modifier::BOLD),
        ),
        Span::raw(" "),
        Span::styled(
            "PATIENT MONITOR",
            Style::default()
                .fg(app.theme.text)
                .add_modifier(Modifier::BOLD),
        ),
        Span::raw("  "),
        Span::styled(
            format!("[ {} ]", state_text),
            Style::default()
                .fg(state_color)
                .add_modifier(Modifier::BOLD),
        ),
        Span::raw(" "),
        Span::styled("●", Style::default().fg(state_color)),
    ]);
    f.render_widget(
        Paragraph::new(line).style(Style::default().bg(app.theme.background)),
        area,
    );
}

fn draw_status_bar(f: &mut Frame, app: &App, area: Rect) {
    let items = [
        format!("Sim: {:.3} us", app.timeline.current_time_ns / 1000.0),
        format!("Lead II 25mm/s"),
        format!("Gain 10mm/mV"),
        format!("Speed: {:.1}x", app.timeline.speed),
        format!("Zoom: {:.1} ns/ch", app.timeline.ns_per_char),
    ];

    let mut spans: Vec<Span> = vec![Span::raw(" ")];
    for item in &items {
        spans.push(Span::styled(item.clone(), Style::default().fg(app.theme.status)));
        spans.push(Span::raw(" │ "));
    }
    spans.push(Span::styled(
        format!("FPS: {:.0}", app.fps),
        Style::default().fg(app.theme.status),
    ));

    let line = Line::from(spans);
    f.render_widget(
        Paragraph::new(line).style(Style::default().bg(app.theme.background)),
        area,
    );
}

fn draw_main_area(f: &mut Frame, app: &mut App, area: Rect) {
    draw_waveform_area(f, app, area);
}

fn draw_waveform_area(f: &mut Frame, app: &mut App, area: Rect) {
    let width = area.width as usize;
    let left_edge_time = app.timeline.left_edge(area.width);

    let sig_count = app.source.signal_count();

    // Each signal occupies a "band" of rows drawn as a continuous thin-line
    // trace (medical-monitor style). 1-bit digital signals use a short 3-row
    // band (high line / low line with vertical steps); analog and wide buses
    // get a tall band so the waveform has vertical resolution.
    let band_height: Vec<usize> = (0..sig_count)
        .map(|i| {
            let info = app.source.signal_info(i);
            if info.signal_type == "analog" {
                11
            } else if info.width == 1 {
                3
            } else {
                11
            }
        })
        .collect();
    let total_rows = band_height.iter().sum::<usize>().max(1);

    // Char grid + per-cell color grid (so each trace keeps its own color
    // while the ECG grid shows through the empty cells).
    let mut grid: Vec<Vec<char>> = vec![vec![' '; width.max(1)]; total_rows];
    let mut colors: Vec<Vec<Color>> =
        vec![vec![app.theme.background; width.max(1)]; total_rows];

    // 1) ECG-style graph-paper grid background.
    for r in 0..total_rows {
        for x in 0..width {
            let (c, col) = grid_char(x, r, total_rows);
            grid[r][x] = c;
            colors[r][x] = col;
        }
    }

    // 2) Draw each signal as a thin-line trace into its band.
    let mut row_off = 0usize;
    for i in 0..sig_count {
        let h = band_height[i];
        let color = app.theme.get_signal_color(i);

        // Thin horizontal baseline through the middle of the band.
        let mid = row_off + h / 2;
        grid[mid][0..width].fill('─');
        colors[mid][0..width].fill(app.theme.grid_fine);

        draw_trace(&mut grid, &mut colors, row_off, h, width, color, app, left_edge_time, i);

        // 3) Bright "head" dot at the sweep (now) position.
        draw_head(&mut grid, &mut colors, row_off, h, width, color, app, left_edge_time, i);

        // 4) Label the band with its signal name (left-aligned, with a
        //    selection marker) so each trace lines up with its own label
        //    instead of a separate, misaligned side list.
        let selected = i == app.selected_signal;
        let marker = if selected { "▶ " } else { "  " };
        let label = format!("{}{}", marker, app.source.signal_info(i).name);
        let name_cols = width.min(26);
        for (c, ch) in label.chars().take(name_cols).enumerate() {
            grid[row_off][c] = ch;
            colors[row_off][c] = if selected {
                app.theme.selected
            } else {
                color
            };
        }

        row_off += h;
    }

    // 4) Sweep bar — the faint vertical line marking "now".
    let sweep_x = (width as f64 - 1.0).max(0.0) as usize;
    if sweep_x < width {
        for r in 0..total_rows {
            grid[r][sweep_x] = '│';
            colors[r][sweep_x] = app.theme.sweep;
        }
    }

    let lines: Vec<Line> = (0..total_rows)
        .map(|r| {
            let spans: Vec<Span> = (0..width)
                .map(|x| {
                    Span::styled(
                        grid[r][x].to_string(),
                        Style::default()
                            .fg(colors[r][x])
                            .bg(app.theme.background),
                    )
                })
                .collect();
            Line::from(spans)
        })
        .collect();

    let wave_widget = Paragraph::new(lines).style(Style::default().bg(app.theme.background));
    f.render_widget(wave_widget, area);
}

/// Map any signal state to a normalized trace value in [-1, 1], or None for
/// "no signal" (unknown / high-impedance) so the trace shows a gap.
fn state_value(s: &SignalState) -> Option<f64> {
    match s {
        SignalState::High => Some(1.0),
        SignalState::Low => Some(-1.0),
        SignalState::Analog(v) => Some(*v),
        SignalState::Bus(v) => Some(bus_to_value(v)),
        SignalState::Unknown | SignalState::HighImpedance => None,
    }
}

/// Interpret a bus value (binary / hex / decimal) as a normalized [-1, 1] wave.
fn bus_to_value(raw: &str) -> f64 {
    let s = raw.trim();
    let n = if let Some(hex) = s.strip_prefix("0x").or_else(|| s.strip_prefix("0X")) {
        i64::from_str_radix(hex, 16).unwrap_or(0)
    } else if s.chars().all(|c| c == '0' || c == '1') && !s.is_empty() {
        i64::from_str_radix(s, 2).unwrap_or(0)
    } else {
        s.parse::<i64>().unwrap_or(0)
    };
    // 8-bit-ish normalization; clamps gracefully for other widths.
    (n as f64 / 255.0).clamp(-1.0, 1.0)
}

/// Graph-paper grid cell. Major vertical lines every 20 cols, minor every 4.
fn grid_char(x: usize, r: usize, total_rows: usize) -> (char, Color) {
    if x % 20 == 0 {
        ('┼', Color::Rgb(0, 70, 34))
    } else if x % 4 == 0 {
        ('│', Color::Rgb(0, 38, 18))
    } else if r == total_rows / 2 {
        ('─', Color::Rgb(0, 30, 15))
    } else {
        (' ', Color::Rgb(0, 38, 18))
    }
}

/// Draw a continuous thin-line trace for signal `i` across its band.
/// Horizontal runs use `─`; vertical steps use `│` with a dim glow behind.
fn draw_trace(
    grid: &mut [Vec<char>],
    colors: &mut [Vec<Color>],
    row_off: usize,
    h: usize,
    width: usize,
    color: Color,
    app: &App,
    left_edge_time: f64,
    i: usize,
) {
    let mid = row_off + h / 2;
    let amp = (h as f64 / 2.0) - 0.5;
    let mut prev_y: Option<usize> = None;

    for x in 0..width {
        let t = left_edge_time + (x as f64) * app.timeline.ns_per_char;
        let v = state_value(&app.source.get_state(i, t));

        let y = match v {
            None => {
                prev_y = None;
                continue;
            }
            Some(val) => (mid as f64 - val * amp)
                .round()
                .clamp(row_off as f64, (row_off + h - 1) as f64) as usize,
        };

        match prev_y {
            Some(py) if py == y => {
                grid[y][x] = '─';
                colors[y][x] = color;
            }
            Some(py) => {
                // Vertical step: connector through the intermediate rows.
                let (lo, hi) = if py <= y { (py, y) } else { (y, py) };
                for ry in lo..=hi {
                    let on_trace = ry == y || ry == py;
                    grid[ry][x] = if on_trace { '─' } else { '│' };
                    colors[ry][x] = if on_trace { color } else { app.theme.trace_glow };
                }
            }
            None => {
                grid[y][x] = '─';
                colors[y][x] = color;
            }
        }
        prev_y = Some(y);
    }
}

fn draw_head(
    grid: &mut [Vec<char>],
    colors: &mut [Vec<Color>],
    row_off: usize,
    h: usize,
    width: usize,
    color: Color,
    app: &App,
    left_edge_time: f64,
    i: usize,
) {
    let x = (width as f64 - 1.0).max(0.0) as usize;
    if x >= width {
        return;
    }
    let t = left_edge_time + (x as f64) * app.timeline.ns_per_char;
    if let Some(v) = state_value(&app.source.get_state(i, t)) {
        let mid = row_off + h / 2;
        let amp = (h as f64 / 2.0) - 0.5;
        let y = (mid as f64 - v * amp)
            .round()
            .clamp(row_off as f64, (row_off + h - 1) as f64) as usize;
        grid[y][x] = '●';
        colors[y][x] = app.theme.head;
    } else {
        let _ = color;
    }
}

fn draw_info_panel(f: &mut Frame, app: &App, area: Rect) {
    let info = app.source.signal_info(app.selected_signal);
    let state = app.source.get_state(app.selected_signal, app.timeline.cursor_time_ns);
    let trans_count = app.source.count_transitions(
        app.selected_signal,
        0.0,
        app.timeline.cursor_time_ns,
    );

    // Derived "vitals": if an analog (ECG) channel is visible, present a
    // patient-monitor style readout (HR scaled to a realistic bpm figure).
    let is_ecg = info.signal_type == "analog" && info.period_ns > 0.0;
    let hr = if is_ecg {
        // Map the simulated beat period to a plausible displayed heart rate.
        (60.0 / (info.period_ns / 1_000_000_000.0)).round() as i64
    } else {
        0
    };

    let val_str = match &state {
        SignalState::High => "HIGH".into(),
        SignalState::Low => "LOW".into(),
        SignalState::Analog(v) => format!("{:+.2}", v),
        SignalState::Bus(v) => format!("0x{:X}", u64::from_str_radix(v.trim_start_matches('0'), 2).unwrap_or(0)),
        SignalState::Unknown => "UNKNOWN".into(),
        SignalState::HighImpedance => "HIGH-Z".into(),
    };

    let time_str = format!("{:.3} us", app.timeline.current_time_ns / 1000.0);
    let cursor_str = format!("{:.1} ns", app.timeline.cursor_time_ns);

    let mut text = vec![
        Line::from(vec![
            Span::styled(" CH ", Style::default().fg(app.theme.ecg).add_modifier(Modifier::BOLD)),
            Span::styled(info.name.clone(), Style::default().fg(app.theme.selected).add_modifier(Modifier::BOLD)),
        ]),
        Line::from(vec![
            Span::styled("  ", Style::default()),
            Span::styled(info.signal_type.clone(), Style::default().fg(app.theme.data)),
        ]),
        Line::from(vec![
            Span::styled("  VALUE  ", Style::default().fg(app.theme.text)),
            Span::styled(val_str, Style::default().fg(app.theme.ecg).add_modifier(Modifier::BOLD)),
        ]),
        Line::from(vec![
            Span::styled("  TRANS  ", Style::default().fg(app.theme.text)),
            Span::styled(trans_count.to_string(), Style::default().fg(app.theme.status)),
        ]),
    ];

    if is_ecg {
        text.push(Line::from(vec![
            Span::styled("  ♥ HR   ", Style::default().fg(app.theme.alert).add_modifier(Modifier::BOLD)),
            Span::styled(format!("{}", hr), Style::default().fg(app.theme.alert).add_modifier(Modifier::BOLD)),
            Span::styled(" bpm", Style::default().fg(app.theme.text)),
        ]));
        text.push(Line::from(vec![
            Span::styled("  SpO₂   ", Style::default().fg(app.theme.cyan)),
            Span::styled("98", Style::default().fg(app.theme.cyan).add_modifier(Modifier::BOLD)),
            Span::styled(" %", Style::default().fg(app.theme.text)),
        ]));
    }

    text.push(Line::from(vec![
        Span::styled(
            format!("  Sim {}  Cur {}  FPS {:.0}", time_str, cursor_str, app.fps),
            Style::default().fg(app.theme.status),
        ),
    ]));

    let block = Block::default()
        .borders(Borders::TOP)
        .style(Style::default().bg(app.theme.background).fg(app.theme.text));

    f.render_widget(Paragraph::new(text).block(block), area);
}

fn draw_help_bar(f: &mut Frame, app: &App, area: Rect) {
    let controls = if app.show_help {
        " [SPACE] hold/run  [↑/↓] select  [+/-] speed  [z/x] zoom  [←/→] cursor  [q] quit "
    } else {
        " [SPACE] hold/run   [↑/↓] select signal   [+/-] speed   [z/x] zoom   [←/→] cursor   [h] more   [q] quit "
    };

    let line = Line::from(vec![Span::styled(
        controls.to_string(),
        Style::default()
            .fg(app.theme.background)
            .bg(app.theme.text),
    )]);
    f.render_widget(
        Paragraph::new(line).style(Style::default().bg(app.theme.background)),
        area,
    );
}
