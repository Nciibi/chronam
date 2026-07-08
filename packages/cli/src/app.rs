use std::time::{Duration, Instant};

use crossterm::event::{self, Event, KeyCode, KeyEvent, KeyEventKind, KeyModifiers};
use ratatui::{backend::Backend, Terminal};
use anyhow::Result;

use crate::wave::WaveSource;
use crate::timeline::Timeline;
use crate::theme::Theme;

pub struct App {
    pub source: Box<dyn WaveSource>,
    pub timeline: Timeline,
    pub theme: Theme,
    pub selected_signal: usize,
    pub paused: bool,
    pub should_quit: bool,
    pub fps: f64,
    pub show_help: bool,
    #[allow(dead_code)]
    pub scroll_offset: usize,
}

impl App {
    pub fn new(source: Box<dyn WaveSource>, total_time_ns: f64) -> Self {
        Self {
            source,
            timeline: Timeline::new(total_time_ns),
            theme: Theme::new(),
            selected_signal: 0,
            paused: false,
            should_quit: false,
            fps: 0.0,
            show_help: false,
            scroll_offset: 0,
        }
    }

    pub fn run<B: Backend>(&mut self, terminal: &mut Terminal<B>) -> Result<()> {
        let mut last_tick = Instant::now();
        let mut frame_count = 0;
        let mut fps_timer = Instant::now();

        loop {
            if self.should_quit {
                return Ok(());
            }

            let timeout = Duration::from_millis(16).saturating_sub(last_tick.elapsed());

            if event::poll(timeout)? {
                match event::read()? {
                    Event::Key(key) if key.kind == KeyEventKind::Press => {
                        self.handle_key(key);
                    }
                    Event::Resize(w, h) => {
                        terminal.resize(ratatui::layout::Rect::new(0, 0, w, h))?;
                    }
                    _ => {}
                }
            }

            let now = Instant::now();
            let delta = now.duration_since(last_tick).as_secs_f64();
            last_tick = now;

            if !self.paused {
                self.timeline.step(delta);
            }

            terminal.draw(|f| crate::tui::draw(f, self))?;

            frame_count += 1;
            if fps_timer.elapsed() >= Duration::from_secs(1) {
                self.fps = frame_count as f64 / fps_timer.elapsed().as_secs_f64();
                frame_count = 0;
                fps_timer = Instant::now();
            }
        }
    }

    fn handle_key(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => self.should_quit = true,
            KeyCode::Char('q') | KeyCode::Esc => self.should_quit = true,
            KeyCode::Char(' ') => self.paused = !self.paused,
            KeyCode::Down => {
                let count = self.source.signal_count();
                if self.selected_signal < count - 1 {
                    self.selected_signal += 1;
                }
            }
            KeyCode::Up => {
                if self.selected_signal > 0 {
                    self.selected_signal -= 1;
                }
            }
            KeyCode::Char('+') | KeyCode::Char('=') => {
                self.timeline.speed = (self.timeline.speed * 1.5).min(10.0);
            }
            KeyCode::Char('-') | KeyCode::Char('_') => {
                self.timeline.speed = (self.timeline.speed / 1.5).max(0.1);
            }
            KeyCode::Char('z') => self.timeline.zoom_in(),
            KeyCode::Char('x') => self.timeline.zoom_out(),
            KeyCode::Char('h') => self.show_help = !self.show_help,
            KeyCode::Left => {
                self.timeline.cursor_time_ns = (self.timeline.cursor_time_ns - self.timeline.ns_per_char * 5.0).max(0.0);
            }
            KeyCode::Right => {
                self.timeline.cursor_time_ns = (self.timeline.cursor_time_ns + self.timeline.ns_per_char * 5.0).min(self.timeline.total_time_ns);
            }
            _ => {}
        }
    }
}
