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
    let mut lines: Vec<Line> = Vec::with_capacity(sig_count);

    for i in 0..sig_count {
        let color = app.theme.get_signal_color(i);
        let mut row: Vec<char> = vec![' '; width.max(1)];

        let transitions = app.source.get_transitions(i, left_edge_time, right_edge);

        let mut current_state = app.source.get_state(i, left_edge_time);
        let mut current_x = 0.0;

        for t in transitions {
            let x_f = app.timeline.time_to_x(t, area.width).max(0.0).min(width as f64);
            let x_int = x_f.floor() as usize;

            draw_segment(&mut row, current_x as usize, x_int.min(width), &current_state);

            let fraction = x_f - x_f.floor();
            if x_int < width {
                let next_state = app.source.get_state(i, t);
                match (&current_state, &next_state) {
                    (SignalState::Low, SignalState::High) => {
                        row[x_int] = if fraction < 0.5 { '▌' } else { '▐' };
                    }
                    (SignalState::High, SignalState::Low) => {
                        row[x_int] = if fraction < 0.5 { '▐' } else { '▌' };
                    }
                    _ => {
                        draw_cell(&mut row, x_int, &next_state);
                    }
                }
            }

            current_state = app.source.get_state(i, t);
            current_x = x_int as f64 + 1.0;
        }

        draw_segment(
            &mut row,
            current_x as usize,
            width,
            &current_state,
        );

        let spans: Vec<Span> = row
            .iter()
            .map(|c| {
                Span::styled(
                    c.to_string(),
                    Style::default().fg(color).bg(app.theme.background),
                )
            })
            .collect();

        lines.push(Line::from(spans));
    }

    let wave_widget = Paragraph::new(lines).style(Style::default().bg(app.theme.background));
    f.render_widget(wave_widget, area);
}

fn draw_segment(row: &mut [char], x_start: usize, x_end: usize, state: &SignalState) {
    for x in x_start..x_end.min(row.len()) {
        match state {
            SignalState::High => row[x] = '█',
            SignalState::Low => row[x] = '─',
            SignalState::Unknown => row[x] = '?',
            SignalState::HighImpedance => row[x] = 'Z',
            SignalState::Bus(val) => {
                if x == x_start {
                    let chars: Vec<char> = val.chars().collect();
                    for (j, c) in chars.iter().enumerate() {
                        let pos = x + j;
                        if pos >= row.len() {
                            break;
                        }
                        row[pos] = *c;
                    }
                }
            }
        }
    }
}

fn draw_cell(row: &mut [char], x: usize, state: &SignalState) {
    if x < row.len() {
        match state {
            SignalState::High => row[x] = '█',
            SignalState::Low => row[x] = '─',
            SignalState::Unknown => row[x] = '?',
            SignalState::HighImpedance => row[x] = 'Z',
            SignalState::Bus(val) => {
                let c = val.chars().next().unwrap_or('X');
                row[x] = c;
            }
        }
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
