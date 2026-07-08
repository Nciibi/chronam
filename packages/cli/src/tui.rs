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

pub fn run_interactive(data: &VcdData) -> io::Result<()> {
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

    disable_raw_mode()?;
    io::stdout().execute(LeaveAlternateScreen)?;
    io::stdout().execute(DisableMouseCapture)?;

    result.map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))
}

pub fn draw(f: &mut Frame, app: &mut App) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(1),
            Constraint::Length(1),
            Constraint::Min(3),
            Constraint::Length(6),
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
    let state_text = if app.paused { "PAUSED" } else { "RUNNING" };
    let state_color = if app.paused { app.theme.paused } else { Color::Green };

    let line = Line::from(vec![
        Span::styled(
            " CHRONAM ",
            Style::default()
                .fg(app.theme.background)
                .bg(app.theme.clock)
                .add_modifier(Modifier::BOLD),
        ),
        Span::raw(" "),
        Span::styled(
            "LIVE SIMULATION",
            Style::default()
                .fg(app.theme.text)
                .add_modifier(Modifier::BOLD),
        ),
        Span::raw(" "),
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
    let grid_style = Style::default()
        .bg(app.theme.background)
        .fg(Color::Rgb(30, 30, 40));

    let items = [
        format!("Sim: {:.3} us", app.timeline.current_time_ns / 1000.0),
        format!("Cursor: {:.1} ns", app.timeline.cursor_time_ns),
        format!("Speed: {:.1}x", app.timeline.speed),
        format!("Zoom: {:.1} ns/ch", app.timeline.ns_per_char),
        format!(
            "Sigs: {}",
            app.source.signal_count()
        ),
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
    f.render_widget(Paragraph::new(line).style(grid_style), area);
}

fn draw_main_area(f: &mut Frame, app: &mut App, area: Rect) {
    let main_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Length(24), Constraint::Min(10)])
        .split(area);

    draw_signal_list(f, app, main_chunks[0]);
    draw_waveform_area(f, app, main_chunks[1]);
}

fn draw_signal_list(f: &mut Frame, app: &mut App, area: Rect) {
    let items: Vec<ListItem> = (0..app.source.signal_count())
        .map(|i| {
            let info = app.source.signal_info(i);
            let style = if i == app.selected_signal {
                Style::default()
                    .fg(app.theme.selected)
                    .add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(app.theme.get_signal_color(i))
            };
            ListItem::new(Line::from(vec![Span::styled(
                format!(" {}", info.name),
                style,
            )]))
        })
        .collect();

    let list = List::new(items)
        .style(Style::default().bg(app.theme.background))
        .highlight_style(Style::default().bg(Color::Rgb(30, 30, 40)));

    let mut state = ListState::default();
    state.select(Some(app.selected_signal));

    let block = Block::default()
        .borders(Borders::RIGHT)
        .style(Style::default().bg(app.theme.background).fg(Color::Rgb(30, 30, 40)));

    f.render_stateful_widget(list.block(block), area, &mut state);
}

fn draw_waveform_area(f: &mut Frame, app: &App, area: Rect) {
    let width = area.width as usize;
    let right_edge = app.timeline.current_time_ns;
    let left_edge_time = app.timeline.left_edge(area.width);

    let sig_count = app.source.signal_count();

    // Each signal occupies a "band" of rows. Analog (ECG) traces get a tall
    // band so the waveform has vertical resolution; digital signals get one.
    let band_height: Vec<usize> = (0..sig_count)
        .map(|i| {
            if app.source.signal_info(i).signal_type == "analog" {
                9
            } else {
                1
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

    // 2) Draw each trace into its band.
    let mut row_off = 0usize;
    for i in 0..sig_count {
        let h = band_height[i];
        let color = app.theme.get_signal_color(i);
        let is_analog = app.source.signal_info(i).signal_type == "analog";

        if is_analog {
            draw_analog_trace(
                &mut grid,
                &mut colors,
                row_off,
                h,
                width,
                i,
                color,
                app,
                left_edge_time,
                right_edge,
            );
        } else {
            draw_digital_trace(
                &mut grid,
                &mut colors,
                row_off,
                width,
                i,
                color,
                app,
                left_edge_time,
                right_edge,
            );
        }

        // 3) Bright "head" dot at the sweep (now) position.
        draw_head(&mut grid, &mut colors, row_off, h, width, i, color, app, left_edge_time);

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

fn draw_digital_trace(
    grid: &mut [Vec<char>],
    colors: &mut [Vec<Color>],
    row_off: usize,
    width: usize,
    i: usize,
    color: Color,
    app: &App,
    left_edge_time: f64,
    right_edge: f64,
) {
    let transitions = app.source.get_transitions(i, left_edge_time, right_edge);
    let mut current_state = app.source.get_state(i, left_edge_time);
    let mut current_x = 0.0;

    for t in transitions {
        let x_f = app.timeline.time_to_x(t, width as u16).max(0.0).min(width as f64);
        let x_int = x_f.floor() as usize;

        paint_segment(grid, colors, row_off, current_x as usize, x_int.min(width), &current_state, color);

        let fraction = x_f - x_f.floor();
        if x_int < width {
            let next_state = app.source.get_state(i, t);
            match (&current_state, &next_state) {
                (SignalState::Low, SignalState::High) => {
                    grid[row_off][x_int] = if fraction < 0.5 { '▌' } else { '▐' };
                    colors[row_off][x_int] = color;
                }
                (SignalState::High, SignalState::Low) => {
                    grid[row_off][x_int] = if fraction < 0.5 { '▐' } else { '▌' };
                    colors[row_off][x_int] = color;
                }
                _ => paint_cell(grid, colors, row_off, x_int, &next_state, color),
            }
        }

        current_state = app.source.get_state(i, t);
        current_x = x_int as f64 + 1.0;
    }

    paint_segment(grid, colors, row_off, current_x as usize, width, &current_state, color);
}

fn draw_analog_trace(
    grid: &mut [Vec<char>],
    colors: &mut [Vec<Color>],
    row_off: usize,
    h: usize,
    width: usize,
    i: usize,
    color: Color,
    app: &App,
    left_edge_time: f64,
    right_edge: f64,
) {
    let mid = row_off + h / 2;
    let amp = (h as f64 / 2.0).max(1.0) - 0.5;
    let mut prev_y: Option<usize> = None;

    for x in 0..width {
        let t = left_edge_time + (x as f64) * app.timeline.ns_per_char;
        let v = match app.source.get_state(i, t) {
            SignalState::Analog(v) => v,
            _ => 0.0,
        };
        let y = (mid as f64 - v * amp).round().clamp(row_off as f64, (row_off + h - 1) as f64) as usize;

        if let Some(py) = prev_y {
            // Interpolate vertical line between samples (glow + trace).
            let (lo, hi) = if py <= y { (py, y) } else { (y, py) };
            for ry in lo..=hi {
                let glow = ry == y;
                grid[ry][x] = if glow { '█' } else { '│' };
                colors[ry][x] = if glow { color } else { app.theme.trace_glow };
            }
        } else {
            grid[y][x] = '█';
            colors[y][x] = color;
        }
        prev_y = Some(y);
    }
    let _ = (right_edge,);
}

fn draw_head(
    grid: &mut [Vec<char>],
    colors: &mut [Vec<Color>],
    row_off: usize,
    h: usize,
    width: usize,
    i: usize,
    color: Color,
    app: &App,
    left_edge_time: f64,
) {
    let x = (width as f64 - 1.0).max(0.0) as usize;
    if x >= width {
        return;
    }
    let t = left_edge_time + (x as f64) * app.timeline.ns_per_char;
    match app.source.get_state(i, t) {
        SignalState::Analog(v) => {
            let mid = row_off + h / 2;
            let amp = (h as f64 / 2.0).max(1.0) - 0.5;
            let y = (mid as f64 - v * amp)
                .round()
                .clamp(row_off as f64, (row_off + h - 1) as f64) as usize;
            grid[y][x] = '●';
            colors[y][x] = app.theme.head;
        }
        st => {
            paint_cell(grid, colors, row_off, x, &st, app.theme.head);
        }
    }
}

fn paint_segment(
    grid: &mut [Vec<char>],
    colors: &mut [Vec<Color>],
    row_off: usize,
    x_start: usize,
    x_end: usize,
    state: &SignalState,
    color: Color,
) {
    for x in x_start..x_end.min(grid[row_off].len()) {
        paint_cell(grid, colors, row_off, x, state, color);
    }
}

fn paint_cell(
    grid: &mut [Vec<char>],
    colors: &mut [Vec<Color>],
    row_off: usize,
    x: usize,
    state: &SignalState,
    color: Color,
) {
    if row_off >= grid.len() || x >= grid[row_off].len() {
        return;
    }
    let (c, col) = match state {
        SignalState::High => ('█', color),
        SignalState::Low => ('─', color),
        SignalState::Unknown => ('?', color),
        SignalState::HighImpedance => ('Z', color),
        SignalState::Analog(v) => {
            let ch = if *v >= 0.0 { '▄' } else { '▀' };
            (ch, color)
        }
        SignalState::Bus(val) => {
            let c = val.chars().next().unwrap_or('X');
            (c, color)
        }
    };
    grid[row_off][x] = c;
    colors[row_off][x] = col;
}

fn draw_info_panel(f: &mut Frame, app: &App, area: Rect) {
    let info = app.source.signal_info(app.selected_signal);
    let state = app.source.get_state(app.selected_signal, app.timeline.cursor_time_ns);
    let trans_count = app.source.count_transitions(
        app.selected_signal,
        0.0,
        app.timeline.cursor_time_ns,
    );

    let val_str = match &state {
        SignalState::High => "HIGH".into(),
        SignalState::Low => "LOW".into(),
        SignalState::Bus(v) => format!("0x{:X}", u64::from_str_radix(v.trim_start_matches('0'), 2).unwrap_or(0)),
        SignalState::Unknown => "UNKNOWN".into(),
        SignalState::HighImpedance => "HIGH-Z".into(),
    };

    let freq_str = if info.frequency_mhz > 0.0 {
        format!("{:.2} MHz", info.frequency_mhz)
    } else {
        "—".to_string()
    };

    let time_str = format!("{:.3} us", app.timeline.current_time_ns / 1000.0);
    let cursor_str = format!("{:.1} ns", app.timeline.cursor_time_ns);
    let speed_str = format!("{:.1}x", app.timeline.speed);
    let zoom_str = format!("{:.1} ns/ch", app.timeline.ns_per_char);

    let text = vec![
        Line::from(vec![
            Span::styled(" Selected Signal : ", Style::default().fg(app.theme.text)),
            Span::styled(
                info.name.clone(),
                Style::default()
                    .fg(app.theme.selected)
                    .add_modifier(Modifier::BOLD),
            ),
        ]),
        Line::from(vec![
            Span::styled(" Type            : ", Style::default().fg(app.theme.text)),
            Span::styled(info.signal_type.clone(), Style::default().fg(app.theme.data)),
        ]),
        Line::from(vec![
            Span::styled(" Current Value   : ", Style::default().fg(app.theme.text)),
            Span::styled(val_str, Style::default().fg(app.theme.clock)),
        ]),
        Line::from(vec![
            Span::styled(" Transitions     : ", Style::default().fg(app.theme.text)),
            Span::styled(trans_count.to_string(), Style::default().fg(app.theme.status)),
        ]),
        Line::from(vec![
            Span::styled(" Frequency       : ", Style::default().fg(app.theme.text)),
            Span::styled(freq_str, Style::default().fg(app.theme.enable)),
        ]),
        Line::from(vec![
            Span::styled(
                format!(" Sim: {}  Cursor: {}  Speed: {}  Zoom: {}  FPS: {:.0}",
                    time_str, cursor_str, speed_str, zoom_str, app.fps),
                Style::default().fg(app.theme.status),
            ),
        ]),
    ];

    let block = Block::default()
        .borders(Borders::TOP)
        .style(Style::default().bg(app.theme.background).fg(app.theme.text));

    f.render_widget(Paragraph::new(text).block(block), area);
}

fn draw_help_bar(f: &mut Frame, app: &App, area: Rect) {
    let text = if app.show_help {
        " [Space] Pause  [↑↓] Select  [+/-] Speed  [z/x] Zoom  [←→] Cursor  [h] Help  [q] Quit"
    } else {
        " Press [h] for help"
    };

    let line = Line::from(vec![Span::styled(
        format!(" {} ", text),
        Style::default()
            .fg(app.theme.background)
            .bg(app.theme.text),
    )]);
    f.render_widget(
        Paragraph::new(line).style(Style::default().bg(app.theme.background)),
        area,
    );
}
