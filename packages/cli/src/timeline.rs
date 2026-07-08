pub struct Timeline {
    pub current_time_ns: f64,
    pub cursor_time_ns: f64,
    pub ns_per_char: f64,
    pub speed: f64,
    pub total_time_ns: f64,
}

impl Timeline {
    pub fn new(total_time_ns: f64) -> Self {
        Self {
            current_time_ns: total_time_ns.min(1000.0),
            cursor_time_ns: total_time_ns.min(800.0),
            ns_per_char: 5.0,
            speed: 1.0,
            total_time_ns,
        }
    }

    pub fn step(&mut self, delta_secs: f64) {
        let delta_ns = delta_secs * 100.0 * self.speed;
        self.current_time_ns = (self.current_time_ns + delta_ns).min(self.total_time_ns);
        self.cursor_time_ns = self.cursor_time_ns.min(self.current_time_ns);
        if self.current_time_ns >= self.total_time_ns {
            self.current_time_ns = 0.0;
            self.cursor_time_ns = 0.0;
        }
    }

    pub fn time_to_x(&self, time: f64, width: u16) -> f64 {
        let right_edge = self.current_time_ns;
        let left_edge = right_edge - (width as f64 * self.ns_per_char);
        ((time - left_edge) / self.ns_per_char).max(-1.0).min(width as f64 + 1.0)
    }

    pub fn x_to_time(&self, x: u16, width: u16) -> f64 {
        let right_edge = self.current_time_ns;
        let left_edge = right_edge - (width as f64 * self.ns_per_char);
        left_edge + (x as f64 * self.ns_per_char)
    }

    pub fn zoom_in(&mut self) {
        self.ns_per_char = (self.ns_per_char / 1.2).max(0.5);
    }

    pub fn zoom_out(&mut self) {
        self.ns_per_char = (self.ns_per_char * 1.2).min(self.total_time_ns / 10.0).min(1000.0);
    }

    pub fn left_edge(&self, width: u16) -> f64 {
        self.current_time_ns - (width as f64 * self.ns_per_char)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_time_x_conversion() {
        let mut tl = Timeline::new(2000.0);
        tl.current_time_ns = 1000.0;
        tl.ns_per_char = 10.0;
        let width = 100u16;

        assert!((tl.time_to_x(1000.0, width) - 100.0).abs() < 0.01);
        assert!((tl.time_to_x(0.0, width) - 0.0).abs() < 0.01);
        assert!((tl.x_to_time(50, width) - 500.0).abs() < 0.01);
    }

    #[test]
    fn test_zoom() {
        let mut tl = Timeline::new(2000.0);
        tl.ns_per_char = 10.0;

        tl.zoom_in();
        assert!((tl.ns_per_char - 10.0 / 1.2).abs() < 0.001);

        tl.zoom_out();
        tl.zoom_out();
        assert!((tl.ns_per_char - 10.0).abs() < 0.001);
    }

    #[test]
    fn test_step_loops() {
        let mut tl = Timeline::new(1000.0);
        tl.current_time_ns = 990.0;
        tl.step(1.0);
        assert!(tl.current_time_ns < 100.0);
    }
}
