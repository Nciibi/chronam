use crate::vcd::VcdData;

#[derive(Debug, Clone)]
pub enum SignalState {
    Low,
    High,
    Bus(String),
    Unknown,
    HighImpedance,
}

#[derive(Debug, Clone)]
pub struct SignalInfo {
    pub name: String,
    #[allow(dead_code)]
    pub path: String,
    pub signal_type: String,
    #[allow(dead_code)]
    pub width: u32,
}

pub trait WaveSource: Send {
    fn signal_count(&self) -> usize;
    fn signal_info(&self, idx: usize) -> SignalInfo;
    fn get_state(&self, idx: usize, time_ns: f64) -> SignalState;
    fn get_transitions(&self, idx: usize, start_ns: f64, end_ns: f64) -> Vec<f64>;
    fn count_transitions(&self, idx: usize, start_ns: f64, end_ns: f64) -> u64;
}

pub struct VcdSource {
    data: VcdData,
    sig_indices: Vec<usize>,
}

impl VcdSource {
    pub fn new(data: VcdData) -> Self {
        let sig_indices: Vec<usize> = (0..data.signals.len()).collect();
        Self { data, sig_indices }
    }

    fn find_changes(&self, idx: usize) -> Vec<(u64, String)> {
        let sig = &self.data.signals[self.sig_indices[idx]];
        let mut changes: Vec<(u64, String)> = self.data.changes
            .iter()
            .filter(|c| c.id == sig.id)
            .map(|c| (c.time, c.value.clone()))
            .collect();
        changes.sort_by_key(|(t, _)| *t);
        changes
    }

    fn get_value_at(&self, changes: &[(u64, String)], time_fs: u64) -> Option<String> {
        let mut val = None;
        for (ct, cv) in changes {
            if *ct <= time_fs {
                val = Some(cv.clone());
            }
        }
        val
    }
}

impl WaveSource for VcdSource {
    fn signal_count(&self) -> usize {
        self.sig_indices.len()
    }

    fn signal_info(&self, idx: usize) -> SignalInfo {
        let sig = &self.data.signals[self.sig_indices[idx]];
        SignalInfo {
            name: sig.name.rsplit('.').next().unwrap_or(&sig.name).to_string(),
            path: sig.name.clone(),
            signal_type: if sig.width == 1 { "std_logic".into() } else { format!("std_logic_vector[{}:0]", sig.width - 1) },
            width: sig.width,
        }
    }

    fn get_state(&self, idx: usize, time_ns: f64) -> SignalState {
        let time_fs = (time_ns * 1_000_000.0) as u64;
        let changes = self.find_changes(idx);
        let val = self.get_value_at(&changes, time_fs);

        match val {
            Some(v) => {
                if self.data.signals[self.sig_indices[idx]].width == 1 {
                    match v.as_str() {
                        "1" | "h" => SignalState::High,
                        "0" | "l" => SignalState::Low,
                        "z" => SignalState::HighImpedance,
                        "x" | "u" | "w" | "-" => SignalState::Unknown,
                        _ => SignalState::Unknown,
                    }
                } else {
                    SignalState::Bus(v)
                }
            }
            None => SignalState::Unknown,
        }
    }

    fn get_transitions(&self, idx: usize, start_ns: f64, end_ns: f64) -> Vec<f64> {
        let start_fs = (start_ns * 1_000_000.0) as u64;
        let end_fs = (end_ns * 1_000_000.0) as u64;
        let changes = self.find_changes(idx);

        changes.iter()
            .filter(|(t, _)| *t >= start_fs && *t <= end_fs)
            .map(|(t, _)| *t as f64 / 1_000_000.0)
            .collect()
    }

    fn count_transitions(&self, idx: usize, start_ns: f64, end_ns: f64) -> u64 {
        let start_fs = (start_ns * 1_000_000.0) as u64;
        let end_fs = (end_ns * 1_000_000.0) as u64;
        let changes = self.find_changes(idx);

        changes.iter()
            .filter(|(t, _)| *t >= start_fs && *t <= end_fs)
            .count() as u64
    }
}
