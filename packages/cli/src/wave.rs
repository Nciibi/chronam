use crate::vcd::VcdData;

#[derive(Debug, Clone)]
pub enum SignalState {
    Low,
    High,
    Bus(String),
    Unknown,
    HighImpedance,
    Analog(f64),
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct SignalInfo {
    pub name: String,
    pub path: String,
    pub signal_type: String,
    pub driver: String,
    pub period_ns: f64,
    pub frequency_mhz: f64,
    pub duty_cycle: f64,
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
    // Per-signal changes, pre-sorted by time, computed once at construction.
    // This avoids cloning + re-sorting the full change list on every cell
    // lookup (which previously made rendering O(n² log n) per frame).
    changes_cache: Vec<Vec<(u64, String)>>,
}

impl VcdSource {
    pub fn new(data: VcdData) -> Self {
        let sig_indices: Vec<usize> = (0..data.signals.len()).collect();
        let changes_cache: Vec<Vec<(u64, String)>> = data
            .signals
            .iter()
            .map(|sig| {
                let mut changes: Vec<(u64, String)> = data
                    .changes
                    .iter()
                    .filter(|c| c.id == sig.id)
                    .map(|c| (c.time, c.value.clone()))
                    .collect();
                changes.sort_by_key(|(t, _)| *t);
                changes
            })
            .collect();
        Self { data, sig_indices, changes_cache }
    }

    fn find_changes(&self, idx: usize) -> &[(u64, String)] {
        &self.changes_cache[self.sig_indices[idx]]
    }

    fn get_value_at(&self, changes: &[(u64, String)], time_fs: u64) -> Option<String> {
        // `changes` is sorted by time (see `new`). Find the last entry with
        // ct <= time_fs via binary search instead of a linear scan, otherwise
        // rendering is O(n) per cell and crawls on large VCDs.
        if changes.is_empty() || changes[0].0 > time_fs {
            return None;
        }
        let mut lo = 0usize;
        let mut hi = changes.len();
        while lo < hi {
            let mid = (lo + hi) / 2;
            if changes[mid].0 <= time_fs {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        if lo == 0 {
            None
        } else {
            Some(changes[lo - 1].1.clone())
        }
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
            driver: String::new(),
            period_ns: 0.0,
            frequency_mhz: 0.0,
            duty_cycle: 0.0,
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

#[allow(dead_code)]
pub struct MockSource {
    signals: Vec<SignalInfo>,
}

impl MockSource {
    pub fn new() -> Self {
        let signals = vec![
            SignalInfo {
                name: "clk".into(), path: "top.clk".into(), signal_type: "std_logic".into(),
                driver: "clock_generator".into(), period_ns: 20.0, frequency_mhz: 50.0, duty_cycle: 50.0, width: 1,
            },
            SignalInfo {
                name: "reset".into(), path: "top.reset".into(), signal_type: "std_logic".into(),
                driver: "sys_ctrl".into(), period_ns: 0.0, frequency_mhz: 0.0, duty_cycle: 0.0, width: 1,
            },
            SignalInfo {
                name: "enable".into(), path: "top.enable".into(), signal_type: "std_logic".into(),
                driver: "sys_ctrl".into(), period_ns: 0.0, frequency_mhz: 0.0, duty_cycle: 0.0, width: 1,
            },
            SignalInfo {
                name: "data[7:0]".into(), path: "top.data".into(), signal_type: "std_logic_vector".into(),
                driver: "data_drv".into(), period_ns: 0.0, frequency_mhz: 0.0, duty_cycle: 0.0, width: 8,
            },
            SignalInfo {
                name: "ecg".into(), path: "top.ecg".into(), signal_type: "analog".into(),
                driver: "heart".into(), period_ns: 833.33, frequency_mhz: 0.0, duty_cycle: 0.0, width: 1,
            },
        ];
        Self { signals }
    }
}

/// Generate a normalized ECG (PQRST) waveform value in [-1.0, 1.0]
/// for a given time in nanoseconds. One cardiac cycle every `beat_ns`.
fn ecg_value(time_ns: f64, beat_ns: f64) -> f64 {
    let phase = (time_ns % beat_ns) / beat_ns; // 0..1
    let gauss = |center: f64, width: f64, amp: f64| {
        let d = phase - center;
        amp * (-(d * d) / (2.0 * width * width)).exp()
    };
    // P wave (small bump), QRS complex (sharp), T wave (medium bump)
    let p = gauss(0.18, 0.022, 0.18);
    let q = gauss(0.30, 0.008, -0.12);
    let r = gauss(0.33, 0.0085, 1.0);
    let s = gauss(0.36, 0.010, -0.28);
    let t = gauss(0.58, 0.040, 0.32);
    (p + q + r + s + t).clamp(-1.0, 1.0)
}

impl WaveSource for MockSource {
    fn signal_count(&self) -> usize { self.signals.len() }

    fn signal_info(&self, idx: usize) -> SignalInfo { self.signals[idx].clone() }

    fn get_state(&self, idx: usize, time_ns: f64) -> SignalState {
        match idx {
            0 => {
                if (time_ns % 20.0) < 10.0 { SignalState::High } else { SignalState::Low }
            }
            1 => {
                if time_ns < 150.0 { SignalState::High } else { SignalState::Low }
            }
            2 => {
                if time_ns > 200.0 && (time_ns % 400.0) < 200.0 { SignalState::High } else { SignalState::Low }
            }
            3 => {
                let val = ((time_ns / 50.0).floor() as u8) & 0xFF;
                SignalState::Bus(format!("{:08b}", val))
            }
            4 => SignalState::Analog(ecg_value(time_ns, self.signals[4].period_ns)),
            _ => SignalState::Unknown,
        }
    }

    fn get_transitions(&self, idx: usize, start_ns: f64, end_ns: f64) -> Vec<f64> {
        let mut trans = Vec::new();
        match idx {
            0 => {
                let mut t = (start_ns / 10.0).ceil() * 10.0;
                while t <= end_ns {
                    if t >= start_ns { trans.push(t); }
                    t += 10.0;
                }
            }
            1 => if start_ns <= 150.0 && end_ns >= 150.0 { trans.push(150.0); },
            2 => {
                let mut t = (start_ns / 200.0).ceil() * 200.0;
                if t == 0.0 { t = 200.0; }
                while t <= end_ns {
                    if t >= start_ns && t >= 200.0 { trans.push(t); }
                    t += 200.0;
                }
            }
            3 => {
                let mut t = (start_ns / 50.0).ceil() * 50.0;
                while t <= end_ns {
                    if t >= start_ns { trans.push(t); }
                    t += 50.0;
                }
            }
            _ => {}
        }
        trans
    }

    fn count_transitions(&self, idx: usize, start_ns: f64, end_ns: f64) -> u64 {
        self.get_transitions(idx, start_ns, end_ns).len() as u64
    }
}
