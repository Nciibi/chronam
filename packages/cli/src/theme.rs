use ratatui::style::Color;

pub struct Theme {
    pub background: Color,
    pub clock: Color,
    pub reset: Color,
    pub enable: Color,
    pub data: Color,
    pub unknown: Color,
    pub selected: Color,
    pub status: Color,
    pub paused: Color,
    pub text: Color,
    pub grid_major: Color,
    pub grid_minor: Color,
}

impl Theme {
    pub fn new() -> Self {
        Self {
            background: Color::Rgb(10, 12, 16),
            clock: Color::Rgb(0, 255, 255),
            reset: Color::Rgb(255, 50, 80),
            enable: Color::Rgb(0, 255, 150),
            data: Color::Rgb(255, 200, 0),
            unknown: Color::Rgb(255, 100, 0),
            selected: Color::White,
            status: Color::Rgb(100, 150, 255),
            paused: Color::Rgb(255, 191, 0),
            text: Color::Rgb(200, 200, 220),
            grid_major: Color::Rgb(30, 40, 30),
            grid_minor: Color::Rgb(15, 20, 15),
        }
    }

    pub fn signal_color(&self, idx: usize) -> Color {
        match idx % 8 {
            0 => self.clock,
            1 => self.reset,
            2 => self.enable,
            3 => self.data,
            4 => Color::Rgb(189, 147, 249),
            5 => Color::Rgb(255, 107, 107),
            6 => Color::Rgb(139, 233, 253),
            7 => Color::Rgb(255, 184, 108),
            _ => self.unknown,
        }
    }
}
