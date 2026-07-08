use ratatui::style::Color;

/// Classic patient-monitor palette: phosphor green traces on near-black,
/// with amber/red alerts and a cyan auxiliary channel — exactly like a
/// hospital bedside heart-rate monitor.
pub struct Theme {
    pub background: Color,
    pub trace: Color,
    pub trace_glow: Color,
    pub grid_fine: Color,
    pub grid_major: Color,
    pub sweep: Color,
    pub head: Color,
    pub alert: Color,
    pub warn: Color,
    pub cyan: Color,
    pub text: Color,
    pub selected: Color,
    pub status: Color,
    pub paused: Color,
    pub clock: Color,
    pub reset: Color,
    pub enable: Color,
    pub data: Color,
    pub unknown: Color,
    pub ecg: Color,
}

impl Theme {
    pub fn new() -> Self {
        Self {
            background: Color::Rgb(2, 6, 4),
            trace: Color::Rgb(0, 255, 90),
            trace_glow: Color::Rgb(0, 120, 45),
            grid_fine: Color::Rgb(0, 38, 18),
            grid_major: Color::Rgb(0, 70, 34),
            sweep: Color::Rgb(0, 150, 70),
            head: Color::Rgb(180, 255, 200),
            alert: Color::Rgb(255, 60, 60),
            warn: Color::Rgb(255, 191, 0),
            cyan: Color::Rgb(0, 220, 255),
            text: Color::Rgb(170, 210, 180),
            selected: Color::Rgb(220, 255, 230),
            status: Color::Rgb(0, 200, 90),
            paused: Color::Rgb(255, 191, 0),
            clock: Color::Rgb(0, 220, 255),
            reset: Color::Rgb(255, 60, 60),
            enable: Color::Rgb(255, 191, 0),
            data: Color::Rgb(0, 255, 150),
            unknown: Color::Rgb(255, 100, 0),
            ecg: Color::Rgb(0, 255, 90),
        }
    }

    pub fn get_signal_color(&self, idx: usize) -> Color {
        match idx {
            0 => self.clock,
            1 => self.reset,
            2 => self.enable,
            3 => self.data,
            4 => self.ecg,
            _ => self.unknown,
        }
    }
}
